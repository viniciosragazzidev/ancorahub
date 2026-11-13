import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";
import { isManagerRouteAllowed, isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpDatabase } from "./access";
import { ErpError } from "./contracts";
import {
  ANALYTICS_TIME_ZONE, daysOfMonth, dayKey, decimalToCents, fillBuckets, isMonth, isPartialMonth, monthKey, monthRange,
  shareBasisPoints, shiftMonth, sumCents, yoyBasisPoints,
} from "./analytics-core";

export type MetricUnit = "count" | "cents";
export type MetricDefinition = { id: string; version: number; label: string; unit: MetricUnit; fact: string; dateBasis: string; description: string };

/** Catalog of approved metrics. A definition change bumps `version`; the UI shows this as the calculation memory. */
export const ANALYTICS_METRICS = {
  production_count: { id: "production_count", version: 1, label: "Vendas", unit: "count", fact: "Vendas (sales)", dateBasis: "Data da venda, no fuso de São Paulo", description: "Cada venda ativa conta uma vez, mesmo com várias parcelas ou comissões. Vendas canceladas ficam fora e aparecem em separado." },
  production_value: { id: "production_value", version: 1, label: "Valor vendido", unit: "cents", fact: "Vendas (sales)", dateBasis: "Data da venda, no fuso de São Paulo", description: "Soma do valor comercial informado em cada venda ativa. Não é receita da corretora nem mensalidade recebida." },
  cancelled_count: { id: "cancelled_count", version: 1, label: "Canceladas", unit: "count", fact: "Vendas (sales)", dateBasis: "Data da venda, no fuso de São Paulo", description: "Vendas registradas no período que hoje estão canceladas." },
  implanted_count: { id: "implanted_count", version: 1, label: "Implantações", unit: "count", fact: "Implantações do ERP", dateBasis: "Início de cobertura; sem ele, a data da última atualização", description: "Negócios com implantação concluída (status Implantada). Implantação não comprova recebimento." },
  cash_received: { id: "cash_received", version: 1, label: "Recebido pela corretora", unit: "cents", fact: "Liquidações do financeiro", dateBasis: "Data efetiva da liquidação", description: "Liquidações confirmadas de recebíveis da corretora, menos estornos confirmados." },
  leads_created: { id: "leads_created", version: 1, label: "Leads recebidos", unit: "count", fact: "Leads", dateBasis: "Data de entrada do lead, no fuso de São Paulo", description: "Leads criados no dia, sem excluídos. Compara entrada com a data do fato da venda; não é taxa de conversão." },
} as const satisfies Record<string, MetricDefinition>;
export type MetricId = keyof typeof ANALYTICS_METRICS;

type Auth = Awaited<ReturnType<typeof requireErpAccess>>;
export type AnalyticsVisibility = { values: boolean; cash: boolean };

/** Supervisor (owners of other people) sees counts only; cash only for agency books outside personal scope. */
export function analyticsVisibility(auth: Pick<Auth, "context" | "scope">): AnalyticsVisibility {
  const ownOnly = auth.scope.mode === "owners" && auth.scope.ownerIds.length === 1 && auth.scope.ownerIds[0] === auth.context.userId;
  return { values: auth.scope.mode !== "owners" || ownOnly, cash: canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners" };
}

const filtersSchema = z.object({
  from: z.string().optional(), to: z.string().optional(), month: z.string().optional(),
  unit: z.string().trim().max(100).optional().default("").transform((value) => (value === "all" ? "" : value)),
});

type Window = { from: string; to: string };
/** Inlined (not a bind parameter) so the same bucket expression matches in SELECT and GROUP BY. */
const TZ = sql.raw(`'${ANALYTICS_TIME_ZONE}'`);
const monthStart = (month: string) => sql`((${`${month}-01`})::date::timestamp AT TIME ZONE ${TZ})`;

async function unitOptions(db: ErpDatabase, auth: Auth) {
  const scope = auth.scope;
  const ids = scope.mode === "units" ? scope.unitIds : scope.mode === "owners" ? scope.unitIds ?? [] : null;
  if (ids && !ids.length) return [];
  return db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches)
    .where(and(eq(schema.branches.tenantId, auth.context.tenantId), ids ? inArray(schema.branches.id, [...ids]) : undefined)).orderBy(asc(schema.branches.name));
}

async function begin(page: string, raw: unknown, db: ErpDatabase = getDatabase()) {
  const auth = await requireErpAccess("analytics", "erp_view_analytics", db);
  const parsed = filtersSchema.parse(raw ?? {});
  const units = await unitOptions(db, auth);
  if (parsed.unit && !units.some((unit) => unit.id === parsed.unit)) throw new ErpError("Esta unidade está fora do seu escopo.");
  return { auth, db, units, unit: parsed.unit, parsed, visibility: analyticsVisibility(auth), generatedAt: new Date().toISOString(), page };
}

async function audit(db: ErpDatabase, auth: Auth, page: string, filters: Record<string, unknown>) {
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.analytics.viewed", entityType: "erp_access", entityId: page, metadata: { page, filters } });
}

function salesScope(auth: Auth, unit: string, window: Window): SQL | undefined {
  return and(eq(schema.sales.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId),
    unit ? eq(schema.leads.branchId, unit) : undefined,
    sql`${schema.sales.saleDate} >= ${monthStart(window.from)}`, sql`${schema.sales.saleDate} < ${monthStart(shiftMonth(window.to, 1))}`);
}
const salesLeadJoin = () => and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, schema.sales.tenantId));
const activeCount = sql<number>`count(distinct ${schema.sales.id}) filter (where ${schema.sales.status} = 'active')::int`;
const cancelledCount = sql<number>`count(distinct ${schema.sales.id}) filter (where ${schema.sales.status} = 'cancelled')::int`;
const activeCents = sql<string>`coalesce(sum(${schema.sales.saleValue} * 100) filter (where ${schema.sales.status} = 'active'), 0)::numeric(30,0)::text`;

/** Production by sale month. Sales join only their lead (1:1), never installments or commissions. */
async function productionByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const month = sql<string>`to_char(${schema.sales.saleDate} AT TIME ZONE ${TZ}, 'YYYY-MM')`;
  const rows = await db.select({ key: month, count: activeCount, cancelled: cancelledCount, cents: activeCents }).from(schema.sales)
    .innerJoin(schema.leads, salesLeadJoin()).where(salesScope(auth, unit, window)).groupBy(month);
  return rows.map((row) => ({ key: row.key, count: Number(row.count), cancelled: Number(row.cancelled), cents: sumCents([row.cents]) }));
}

async function implantationsByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const month = sql<string>`to_char(coalesce(${schema.erpImplantations.coverageStartsOn}, (${schema.erpImplantations.updatedAt} AT TIME ZONE ${TZ})::date), 'YYYY-MM')`;
  const rows = await db.select({ key: month, count: sql<number>`count(distinct ${schema.erpImplantations.id})::int` }).from(schema.erpImplantations)
    .where(and(eq(schema.erpImplantations.tenantId, auth.context.tenantId), eq(schema.erpImplantations.status, "implanted"),
      erpScopeSql(auth.scope, schema.erpImplantations.branchId, schema.erpImplantations.brokerId), unit ? eq(schema.erpImplantations.branchId, unit) : undefined,
      sql`${month} >= ${window.from}`, sql`${month} <= ${window.to}`)).groupBy(month);
  return rows.map((row) => ({ key: row.key, implanted: Number(row.count) }));
}

async function cashByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const month = sql<string>`left(${schema.erpSettlements.occurredOn}::text, 7)`;
  const rows = await db.select({ key: month, cents: sql<string>`coalesce(sum(CASE WHEN ${schema.erpSettlements.kind} = 'reversal' THEN -${schema.erpSettlements.amountCents} ELSE ${schema.erpSettlements.amountCents} END), 0)::text` })
    .from(schema.erpSettlements)
    .innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.id, schema.erpSettlements.entryId)))
    .where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.status, "confirmed"), eq(schema.erpFinancialEntries.kind, "agency_receivable"),
      erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId), unit ? eq(schema.erpFinancialEntries.branchId, unit) : undefined,
      sql`${month} >= ${window.from}`, sql`${month} <= ${window.to}`)).groupBy(month);
  return rows.map((row) => ({ key: row.key, cash: sumCents([row.cents]) }));
}

function defaultWindow(parsed: z.infer<typeof filtersSchema>, months = 6): Window {
  const to = isMonth(parsed.to) ? parsed.to : monthKey();
  const from = isMonth(parsed.from) ? parsed.from : shiftMonth(to, -(months - 1));
  monthRange(from, to, 24);
  return { from, to };
}

function drillTarget(access: Awaited<ReturnType<typeof getErpEffectiveAccess>>, auth: Auth, path: string) {
  if (!canAccessRoute(access, getRouteDefinition(path))) return null;
  if (isOutsideManagerScope(auth.context.role, auth.context.jobTitle) && !isManagerRouteAllowed(path)) return null;
  return path;
}

const masked = <T>(allowed: boolean, value: T) => (allowed ? value : null);

export async function getProductionReport(raw: unknown) {
  const base = await begin("producao", raw);
  const { auth, db, unit, visibility } = base;
  const window = defaultWindow(base.parsed);
  const months = monthRange(window.from, window.to, 24);
  const [production, implanted, cash, access] = await Promise.all([
    productionByMonth(db, auth, unit, window), implantationsByMonth(db, auth, unit, window),
    visibility.cash ? cashByMonth(db, auth, unit, window) : Promise.resolve([]), getErpEffectiveAccess(auth.context, db),
  ]);
  const rows = fillBuckets(months, [...production], { count: 0, cancelled: 0, cents: 0 }).map((row) => ({
    month: row.key, partial: isPartialMonth(row.key), count: row.count, cancelled: row.cancelled, cents: masked(visibility.values, row.cents),
    implanted: implanted.find((item) => item.key === row.key)?.implanted ?? 0,
    cash: visibility.cash ? cash.find((item) => item.key === row.key)?.cash ?? 0 : null,
  }));
  const totals = { count: rows.reduce((sum, row) => sum + row.count, 0), cancelled: rows.reduce((sum, row) => sum + row.cancelled, 0), implanted: rows.reduce((sum, row) => sum + row.implanted, 0),
    cents: visibility.values ? sumCents(rows.map((row) => row.cents ?? 0)) : null, cash: visibility.cash ? sumCents(rows.map((row) => row.cash ?? 0)) : null };
  await audit(db, auth, "producao", { ...window, unit: unit || null });
  return { ...window, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows, totals, drillHref: drillTarget(access, auth, "/vendas"),
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value, ANALYTICS_METRICS.cancelled_count, ANALYTICS_METRICS.implanted_count, ANALYTICS_METRICS.cash_received] };
}

export async function getCarrierReport(raw: unknown) {
  const base = await begin("operadoras", raw);
  const { auth, db, unit, visibility } = base;
  const window = defaultWindow(base.parsed, 3);
  const plans = and(eq(schema.carrierPlans.id, schema.sales.carrierPlanId), eq(schema.carrierPlans.tenantId, schema.sales.tenantId));
  const carriers = and(eq(schema.carriers.id, schema.carrierPlans.carrierId), eq(schema.carriers.tenantId, schema.carrierPlans.tenantId));
  const rows = await db.select({ carrierId: schema.carriers.id, name: schema.carriers.name, count: activeCount, cancelled: cancelledCount, cents: activeCents }).from(schema.sales)
    .innerJoin(schema.leads, salesLeadJoin()).leftJoin(schema.carrierPlans, plans).leftJoin(schema.carriers, carriers)
    .where(salesScope(auth, unit, window)).groupBy(schema.carriers.id, schema.carriers.name);
  const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
  const totalCents = sumCents(rows.map((row) => row.cents));
  const result = rows.map((row) => {
    const cents = sumCents([row.cents]);
    return { carrierId: row.carrierId, name: row.name ?? "Não informada", count: Number(row.count), cancelled: Number(row.cancelled), share: shareBasisPoints(Number(row.count), total),
      cents: masked(visibility.values, cents), valueShare: visibility.values ? shareBasisPoints(cents, totalCents) : null };
  }).filter((row) => row.count > 0 || row.cancelled > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  await audit(db, auth, "operadoras", { ...window, unit: unit || null });
  return { ...window, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows: result,
    totals: { count: total, cancelled: result.reduce((sum, row) => sum + row.cancelled, 0), cents: masked(visibility.values, totalCents) },
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value, ANALYTICS_METRICS.cancelled_count] };
}

export async function getGrowthReport(raw: unknown) {
  const base = await begin("crescimento", raw);
  const { auth, db, unit, visibility } = base;
  const current = monthKey();
  const window = { from: shiftMonth(current, -23), to: current };
  const production = await productionByMonth(db, auth, unit, window);
  const byKey = new Map(production.map((row) => [row.key, row]));
  const rows = monthRange(shiftMonth(current, -11), current).map((month) => {
    const now = byKey.get(month) ?? { count: 0, cents: 0, cancelled: 0 };
    const previousMonth = shiftMonth(month, -12);
    const before = byKey.get(previousMonth);
    return { month, previousMonth, partial: isPartialMonth(month), count: now.count, previousCount: before?.count ?? null, countYoy: yoyBasisPoints(now.count, before?.count ?? null),
      cents: masked(visibility.values, now.cents), previousCents: visibility.values ? before?.cents ?? null : null, centsYoy: visibility.values ? yoyBasisPoints(now.cents, before?.cents ?? null) : null };
  });
  await audit(db, auth, "crescimento", { ...window, unit: unit || null });
  return { from: rows[0].month, to: current, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows,
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value] };
}

export async function getDailyReport(raw: unknown) {
  const base = await begin("diario", raw);
  const { auth, db, unit } = base;
  const month = isMonth(base.parsed.month) ? base.parsed.month : monthKey();
  const days = daysOfMonth(month);
  const today = dayKey();
  const saleDay = sql<string>`to_char(${schema.sales.saleDate} AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
  const leadDay = sql<string>`to_char(${schema.leads.createdAt} AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
  const [sales, leads] = await Promise.all([
    db.select({ key: saleDay, count: activeCount, cancelled: cancelledCount }).from(schema.sales).innerJoin(schema.leads, salesLeadJoin())
      .where(salesScope(auth, unit, { from: month, to: month })).groupBy(saleDay),
    db.select({ key: leadDay, leads: sql<number>`count(*)::int` }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt), erpScopeSql(auth.scope, schema.leads.branchId, schema.leads.corretorId),
        unit ? eq(schema.leads.branchId, unit) : undefined, sql`${schema.leads.createdAt} >= ${monthStart(month)}`, sql`${schema.leads.createdAt} < ${monthStart(shiftMonth(month, 1))}`)).groupBy(leadDay),
  ]);
  const rows = days.map((day) => {
    const sale = sales.find((row) => row.key === day); const lead = leads.find((row) => row.key === day);
    const future = day > today;
    return { day, future, count: future ? null : Number(sale?.count ?? 0), cancelled: future ? null : Number(sale?.cancelled ?? 0), leads: future ? null : Number(lead?.leads ?? 0) };
  });
  await audit(db, auth, "diario", { month, unit: unit || null });
  return { month, partial: isPartialMonth(month), unit, units: base.units, visibility: base.visibility, generatedAt: base.generatedAt, rows,
    totals: { count: rows.reduce((sum, row) => sum + (row.count ?? 0), 0), cancelled: rows.reduce((sum, row) => sum + (row.cancelled ?? 0), 0), leads: rows.reduce((sum, row) => sum + (row.leads ?? 0), 0) },
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.cancelled_count, ANALYTICS_METRICS.leads_created] };
}

const GOAL_SCOPE_LABEL = { tenant: "Empresa", branch: "Unidade", team: "Equipe", broker: "Corretor" } as const;
const PERCENT_TYPES = new Set(["conversion_rate", "sla_rate"]);

/** Read-only view of existing goals in the caller's ERP scope; never writes goals or progress. */
export async function getScopedGoals() {
  const db = getDatabase();
  const auth = await requireErpAccess("analytics", "erp_view_analytics", db);
  const visibility = analyticsVisibility(auth);
  const { scope, context } = auth;
  const brokerName = schema.user.name;
  const memberIn = (column: SQL) => sql`${schema.goals.scopeId} IN (SELECT ${schema.tenantMemberships.userId} FROM ${schema.tenantMemberships} WHERE ${schema.tenantMemberships.tenantId} = ${context.tenantId} AND ${column})`;
  let condition: SQL | undefined;
  if (scope.mode === "tenant") condition = undefined;
  else if (scope.mode === "units") {
    const units = [...scope.unitIds];
    condition = or(eq(schema.goals.scope, "tenant"), and(eq(schema.goals.scope, "branch"), inArray(schema.goals.scopeId, units)),
      and(eq(schema.goals.scope, "broker"), memberIn(sql`${inArray(schema.tenantMemberships.branchId, units)}`)),
      and(eq(schema.goals.scope, "team"), memberIn(sql`${inArray(schema.tenantMemberships.branchId, units)}`)));
  } else if (scope.mode === "owners") {
    const owners = [...scope.ownerIds];
    condition = or(and(eq(schema.goals.scope, "broker"), inArray(schema.goals.scopeId, owners)),
      context.role === "supervisor" ? or(and(eq(schema.goals.scope, "team"), eq(schema.goals.scopeId, context.userId)), eq(schema.goals.scope, "tenant")) : undefined);
  } else condition = sql`false`;
  const rows = await db.select({ id: schema.goals.id, name: schema.goals.name, scope: schema.goals.scope, scopeId: schema.goals.scopeId, targetType: schema.goals.targetType,
    targetValue: schema.goals.targetValue, period: schema.goals.period, startDate: schema.goals.startDate, endDate: schema.goals.endDate,
    currentValue: schema.goalProgress.currentValue, percentage: schema.goalProgress.percentage, calculatedAt: schema.goalProgress.calculatedAt,
    branchName: schema.branches.name, brokerName })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, schema.goals.id))
    .leftJoin(schema.branches, and(eq(schema.goals.scope, "branch"), eq(schema.branches.id, schema.goals.scopeId), eq(schema.branches.tenantId, context.tenantId)))
    .leftJoin(schema.user, and(sql`${schema.goals.scope} IN ('broker', 'team')`, eq(schema.user.id, schema.goals.scopeId)))
    .where(and(eq(schema.goals.tenantId, context.tenantId), eq(schema.goals.active, true), condition))
    .orderBy(desc(schema.goals.endDate), asc(schema.goals.name)).limit(200);
  const now = Date.now();
  const access = await getErpEffectiveAccess(context, db);
  const result = rows.map((row) => {
    const own = row.scope === "broker" && row.scopeId === context.userId;
    const hideMoney = row.targetType === "revenue" && !visibility.values && !own;
    const format = (value: string | null) => {
      if (value === null) return null;
      if (row.targetType === "revenue") return hideMoney ? null : { kind: "cents" as const, value: decimalToCents(value) };
      if (PERCENT_TYPES.has(row.targetType)) return { kind: "percent" as const, value };
      if (row.targetType === "response_minutes") return { kind: "minutes" as const, value };
      return { kind: "count" as const, value };
    };
    const status = row.endDate.getTime() < now ? "Encerrada" : row.startDate.getTime() > now ? "Futura" : "Vigente";
    const owner = row.scope === "branch" ? row.branchName : row.scope === "tenant" ? null : row.brokerName;
    return { id: row.id, name: row.name, scopeLabel: GOAL_SCOPE_LABEL[row.scope], owner, targetType: row.targetType, period: row.period,
      startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(), status, hideMoney,
      target: format(row.targetValue), current: format(row.currentValue), percentage: hideMoney ? null : row.percentage, calculatedAt: row.calculatedAt?.toISOString() ?? null };
  });
  await audit(db, auth, "metas", { count: result.length });
  return { rows: result, visibility, generatedAt: new Date().toISOString(), manageHref: drillTarget(access, auth, "/gestao") };
}
