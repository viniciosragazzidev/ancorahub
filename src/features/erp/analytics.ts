import "server-only";

import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";
import { isManagerRouteAllowed, isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { auditActor, auditErp, erpScopeSql, getErpEffectiveAccess, hasAgencyScope, requireErpAccess, type ErpDatabase } from "./access";
import { ErpError } from "./contracts";
import {
  ANALYTICS_TIME_ZONE, daysOfMonth, dayKey, decimalToCents, fillBuckets, isMonth, isPartialMonth, monthKey, monthRange,
  shareBasisPoints, shiftMonth, sumCents, yoyBasisPoints,
} from "./analytics-core";
import { periodBounds } from "./shared";

export type MetricUnit = "count" | "cents";
export type MetricDefinition = { id: string; version: number; label: string; unit: MetricUnit; fact: string; dateBasis: string; description: string };

/** Catalog of approved metrics. A definition change bumps `version`; the UI shows this as the calculation memory. */
export const ANALYTICS_METRICS = {
  production_count: {
    id: "production_count", version: 1, label: "Vendas", unit: "count", fact: "Vendas (sales)",
    dateBasis: "Data da venda, no fuso de São Paulo",
    description: "Cada venda ativa conta uma vez, mesmo com várias parcelas ou comissões. Vendas canceladas ficam fora e aparecem em separado.",
  },
  production_value: {
    id: "production_value", version: 1, label: "Valor vendido", unit: "cents", fact: "Vendas (sales)",
    dateBasis: "Data da venda, no fuso de São Paulo",
    description: "Soma do valor comercial informado em cada venda ativa. Não é receita da corretora nem mensalidade recebida.",
  },
  cancelled_count: {
    id: "cancelled_count", version: 1, label: "Canceladas", unit: "count", fact: "Vendas (sales)",
    dateBasis: "Data da venda, no fuso de São Paulo",
    description: "Vendas registradas no período que hoje estão canceladas.",
  },
  implanted_count: {
    id: "implanted_count", version: 1, label: "Implantações", unit: "count", fact: "Implantações do ERP",
    dateBasis: "Início de cobertura; sem ele, a data da última atualização",
    description: "Negócios com implantação concluída (status Implantada). Implantação não comprova recebimento.",
  },
  cash_received: {
    id: "cash_received", version: 1, label: "Recebido pela corretora", unit: "cents", fact: "Liquidações do financeiro",
    dateBasis: "Data efetiva da liquidação",
    description: "Liquidações confirmadas de recebíveis da corretora, menos estornos confirmados.",
  },
  leads_created: {
    id: "leads_created", version: 1, label: "Leads recebidos", unit: "count", fact: "Leads",
    dateBasis: "Data de entrada do lead, no fuso de São Paulo",
    description: "Leads criados no dia, sem excluídos. Compara entrada com a data do fato da venda; não é taxa de conversão.",
  },
} as const satisfies Record<string, MetricDefinition>;
export type MetricId = keyof typeof ANALYTICS_METRICS;

type Auth = Awaited<ReturnType<typeof requireErpAccess>>;
export type AnalyticsVisibility = { values: boolean; cash: boolean };

/** Supervisor (owners of other people) sees counts only; cash only for agency books outside personal scope. */
export function analyticsVisibility(auth: Pick<Auth, "context" | "scope">): AnalyticsVisibility {
  const ownOnly = auth.scope.mode === "owners" && auth.scope.ownerIds.length === 1 && auth.scope.ownerIds[0] === auth.context.userId;
  return { values: auth.scope.mode !== "owners" || ownOnly, cash: hasAgencyScope(auth) };
}

const filtersSchema = z.object({
  from: z.string().optional(), to: z.string().optional(), month: z.string().optional(),
  unit: z.string().trim().max(100).optional().default("").transform((value) => (value === "all" ? "" : value)),
});

type Window = { from: string; to: string };
/** Inlined (not a bind parameter) so the same bucket expression matches in SELECT and GROUP BY. */
const TZ = sql.raw(`'${ANALYTICS_TIME_ZONE}'`);

/**
 * Period filters are plain ranges on the stored column (index friendly, e.g. `sales(tenant_id, sale_date)`); the bounds are
 * the first instant / first day of the São Paulo calendar months. Never filter on an expression of the column.
 */
const monthStart = (month: string) => sql`((${`${month}-01`})::date::timestamp AT TIME ZONE ${TZ})`;

/** timestamptz column within the São Paulo months [from, to]. */
export function instantInMonths(column: AnyPgColumn, window: Window): SQL {
  return sql`${column} >= ${monthStart(window.from)} AND ${column} < ${monthStart(shiftMonth(window.to, 1))}`;
}

/** Calendar date column within the months [from, to]. */
export function dateInMonths(column: AnyPgColumn, window: Window): SQL {
  return sql`${column} >= ${periodBounds(window.from).start}::date AND ${column} < ${periodBounds(window.to).end}::date`;
}

/** Implantation month = coverage start; without it, the last update in São Paulo. Same rule as `implantationMonth`. */
export function implantedInMonths(window: Window): SQL {
  const table = schema.erpImplantations;
  const byCoverage = dateInMonths(table.coverageStartsOn, window);
  const byUpdate = instantInMonths(table.updatedAt, window);
  return sql`((${byCoverage}) OR (${table.coverageStartsOn} IS NULL AND ${byUpdate}))`;
}
const implantationDate = sql`coalesce(${schema.erpImplantations.coverageStartsOn}, (${schema.erpImplantations.updatedAt} AT TIME ZONE ${TZ})::date)`;
const implantationMonth = sql<string>`to_char(${implantationDate}, 'YYYY-MM')`;

async function unitOptions(db: ErpDatabase, auth: Auth) {
  const scope = auth.scope;
  const ids = scope.mode === "units" ? scope.unitIds : scope.mode === "owners" ? scope.unitIds ?? [] : null;
  if (ids && !ids.length) return [];
  return db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches)
    .where(and(eq(schema.branches.tenantId, auth.context.tenantId), ids ? inArray(schema.branches.id, [...ids]) : undefined))
    .orderBy(asc(schema.branches.name));
}

async function begin(page: string, raw: unknown, db: ErpDatabase = getDatabase()) {
  const auth = await requireErpAccess("analytics", "erp_view_analytics", db);
  const parsed = filtersSchema.parse(raw ?? {});
  const units = await unitOptions(db, auth);
  if (parsed.unit && !units.some((unit) => unit.id === parsed.unit)) throw new ErpError("Esta unidade está fora do seu escopo.");
  return { auth, db, units, unit: parsed.unit, parsed, visibility: analyticsVisibility(auth), generatedAt: new Date().toISOString(), page };
}

async function audit(db: ErpDatabase, auth: Auth, page: string, filters: Record<string, unknown>) {
  await auditErp(db, {
    tenantId: auth.context.tenantId, actorId: auditActor(auth.context), action: "erp.analytics.viewed",
    entityType: "erp_access", entityId: page, metadata: { page, filters },
  });
}

function salesScope(auth: Auth, unit: string, window: Window): SQL | undefined {
  return and(
    eq(schema.sales.tenantId, auth.context.tenantId), instantInMonths(schema.sales.saleDate, window),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId), unit ? eq(schema.leads.branchId, unit) : undefined,
  );
}
const salesLeadJoin = () => and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, schema.sales.tenantId));
/** A sale joins only its own lead and, for carriers, its plan and carrier (all N:1), so `count(*)` counts each sale once. */
const activeCount = sql<number>`count(*) filter (where ${schema.sales.status} = 'active')::int`;
const cancelledCount = sql<number>`count(*) filter (where ${schema.sales.status} = 'cancelled')::int`;
const activeCents = sql<string>`coalesce(sum(${schema.sales.saleValue} * 100) filter (where ${schema.sales.status} = 'active'), 0)::numeric(30,0)::text`;

/** Production by sale month. Sales join only their lead (1:1), never installments or commissions. */
async function productionByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const month = sql<string>`to_char(${schema.sales.saleDate} AT TIME ZONE ${TZ}, 'YYYY-MM')`;
  const rows = await db.select({ key: month, count: activeCount, cancelled: cancelledCount, cents: activeCents }).from(schema.sales)
    .innerJoin(schema.leads, salesLeadJoin()).where(salesScope(auth, unit, window)).groupBy(month);
  return rows.map((row) => ({ key: row.key, count: Number(row.count), cancelled: Number(row.cancelled), cents: sumCents([row.cents]) }));
}

async function implantationsByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const table = schema.erpImplantations;
  const rows = await db.select({ key: implantationMonth, count: sql<number>`count(*)::int` }).from(table)
    .where(and(
      eq(table.tenantId, auth.context.tenantId), eq(table.status, "implanted"), implantedInMonths(window),
      erpScopeSql(auth.scope, table.branchId, table.brokerId), unit ? eq(table.branchId, unit) : undefined,
    )).groupBy(implantationMonth);
  return rows.map((row) => ({ key: row.key, implanted: Number(row.count) }));
}

async function cashByMonth(db: ErpDatabase, auth: Auth, unit: string, window: Window) {
  const settlements = schema.erpSettlements;
  const entries = schema.erpFinancialEntries;
  const month = sql<string>`to_char(${settlements.occurredOn}, 'YYYY-MM')`;
  const signed = sql`CASE WHEN ${settlements.kind} = 'reversal' THEN -${settlements.amountCents} ELSE ${settlements.amountCents} END`;
  const rows = await db.select({ key: month, cents: sql<string>`coalesce(sum(${signed}), 0)::text` })
    .from(settlements)
    .innerJoin(entries, and(eq(entries.tenantId, auth.context.tenantId), eq(entries.id, settlements.entryId)))
    .where(and(
      eq(settlements.tenantId, auth.context.tenantId), dateInMonths(settlements.occurredOn, window), eq(settlements.status, "confirmed"),
      eq(entries.kind, "agency_receivable"), erpScopeSql(auth.scope, entries.branchId, entries.ownerId),
      unit ? eq(entries.branchId, unit) : undefined,
    )).groupBy(month);
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

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export async function getProductionReport(raw: unknown) {
  const base = await begin("producao", raw);
  const { auth, db, unit, visibility } = base;
  const window = defaultWindow(base.parsed);
  const months = monthRange(window.from, window.to, 24);
  const [production, implanted, cash, access] = await Promise.all([
    productionByMonth(db, auth, unit, window),
    implantationsByMonth(db, auth, unit, window),
    visibility.cash ? cashByMonth(db, auth, unit, window) : Promise.resolve([]),
    getErpEffectiveAccess(auth.context, db),
  ]);
  const rows = fillBuckets(months, [...production], { count: 0, cancelled: 0, cents: 0 }).map((row) => ({
    month: row.key, partial: isPartialMonth(row.key), count: row.count, cancelled: row.cancelled,
    cents: masked(visibility.values, row.cents),
    implanted: implanted.find((item) => item.key === row.key)?.implanted ?? 0,
    cash: visibility.cash ? cash.find((item) => item.key === row.key)?.cash ?? 0 : null,
  }));
  const totals = {
    count: sum(rows.map((row) => row.count)),
    cancelled: sum(rows.map((row) => row.cancelled)),
    implanted: sum(rows.map((row) => row.implanted)),
    cents: visibility.values ? sumCents(rows.map((row) => row.cents ?? 0)) : null,
    cash: visibility.cash ? sumCents(rows.map((row) => row.cash ?? 0)) : null,
  };
  await audit(db, auth, "producao", { ...window, unit: unit || null });
  const metrics = [
    ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value, ANALYTICS_METRICS.cancelled_count,
    ANALYTICS_METRICS.implanted_count, ANALYTICS_METRICS.cash_received,
  ];
  return {
    ...window, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows, totals,
    drillHref: drillTarget(access, auth, "/vendas"), metrics,
  };
}

export async function getCarrierReport(raw: unknown) {
  const base = await begin("operadoras", raw);
  const { auth, db, unit, visibility } = base;
  const window = defaultWindow(base.parsed, 3);
  const plans = and(eq(schema.carrierPlans.id, schema.sales.carrierPlanId), eq(schema.carrierPlans.tenantId, schema.sales.tenantId));
  const carriers = and(eq(schema.carriers.id, schema.carrierPlans.carrierId), eq(schema.carriers.tenantId, schema.carrierPlans.tenantId));
  const rows = await db
    .select({ carrierId: schema.carriers.id, name: schema.carriers.name, count: activeCount, cancelled: cancelledCount, cents: activeCents })
    .from(schema.sales)
    .innerJoin(schema.leads, salesLeadJoin())
    .leftJoin(schema.carrierPlans, plans)
    .leftJoin(schema.carriers, carriers)
    .where(salesScope(auth, unit, window))
    .groupBy(schema.carriers.id, schema.carriers.name);
  const total = sum(rows.map((row) => Number(row.count)));
  const totalCents = sumCents(rows.map((row) => row.cents));
  const result = rows.map((row) => {
    const cents = sumCents([row.cents]);
    return {
      carrierId: row.carrierId, name: row.name ?? "Não informada", count: Number(row.count), cancelled: Number(row.cancelled),
      share: shareBasisPoints(Number(row.count), total),
      cents: masked(visibility.values, cents), valueShare: visibility.values ? shareBasisPoints(cents, totalCents) : null,
    };
  })
    .filter((row) => row.count > 0 || row.cancelled > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  await audit(db, auth, "operadoras", { ...window, unit: unit || null });
  const totals = { count: total, cancelled: sum(result.map((row) => row.cancelled)), cents: masked(visibility.values, totalCents) };
  return {
    ...window, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows: result, totals,
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value, ANALYTICS_METRICS.cancelled_count],
  };
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
    return {
      month, previousMonth, partial: isPartialMonth(month),
      count: now.count, previousCount: before?.count ?? null, countYoy: yoyBasisPoints(now.count, before?.count ?? null),
      cents: masked(visibility.values, now.cents),
      previousCents: visibility.values ? before?.cents ?? null : null,
      centsYoy: visibility.values ? yoyBasisPoints(now.cents, before?.cents ?? null) : null,
    };
  });
  // The 24-month query covers the previous year, so a month without a row had no sale: it counts as zero in the sum.
  const count = sum(rows.map((row) => row.count));
  const previousCount = sum(rows.map((row) => row.previousCount ?? 0));
  const cents = visibility.values ? sumCents(rows.map((row) => row.cents ?? 0)) : null;
  const previousCents = visibility.values ? sumCents(rows.map((row) => row.previousCents ?? 0)) : null;
  const totals = {
    count, previousCount, countYoy: yoyBasisPoints(count, previousCount),
    cents, previousCents, centsYoy: visibility.values ? yoyBasisPoints(cents, previousCents) : null,
  };
  await audit(db, auth, "crescimento", { ...window, unit: unit || null });
  return {
    from: rows[0].month, to: current, unit, units: base.units, visibility, generatedAt: base.generatedAt, rows, totals,
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.production_value],
  };
}

export async function getDailyReport(raw: unknown) {
  const base = await begin("diario", raw);
  const { auth, db, unit } = base;
  const month = isMonth(base.parsed.month) ? base.parsed.month : monthKey();
  const window = { from: month, to: month };
  const days = daysOfMonth(month);
  const today = dayKey();
  const saleDay = sql<string>`to_char(${schema.sales.saleDate} AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
  const leadDay = sql<string>`to_char(${schema.leads.createdAt} AT TIME ZONE ${TZ}, 'YYYY-MM-DD')`;
  const leadsWhere = and(
    eq(schema.leads.tenantId, auth.context.tenantId), instantInMonths(schema.leads.createdAt, window), isNull(schema.leads.deletedAt),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.leads.corretorId), unit ? eq(schema.leads.branchId, unit) : undefined,
  );
  const [sales, leads] = await Promise.all([
    db.select({ key: saleDay, count: activeCount, cancelled: cancelledCount })
      .from(schema.sales)
      .innerJoin(schema.leads, salesLeadJoin())
      .where(salesScope(auth, unit, window))
      .groupBy(saleDay),
    db.select({ key: leadDay, leads: sql<number>`count(*)::int` }).from(schema.leads).where(leadsWhere).groupBy(leadDay),
  ]);
  const rows = days.map((day) => {
    const sale = sales.find((row) => row.key === day);
    const lead = leads.find((row) => row.key === day);
    const future = day > today;
    return {
      day, future,
      count: future ? null : Number(sale?.count ?? 0),
      cancelled: future ? null : Number(sale?.cancelled ?? 0),
      leads: future ? null : Number(lead?.leads ?? 0),
    };
  });
  await audit(db, auth, "diario", { month, unit: unit || null });
  const totals = {
    count: sum(rows.map((row) => row.count ?? 0)),
    cancelled: sum(rows.map((row) => row.cancelled ?? 0)),
    leads: sum(rows.map((row) => row.leads ?? 0)),
  };
  return {
    month, partial: isPartialMonth(month), unit, units: base.units, visibility: base.visibility, generatedAt: base.generatedAt, rows, totals,
    metrics: [ANALYTICS_METRICS.production_count, ANALYTICS_METRICS.cancelled_count, ANALYTICS_METRICS.leads_created],
  };
}

const GOAL_SCOPE_LABEL = { tenant: "Empresa", branch: "Unidade", team: "Equipe", broker: "Corretor" } as const;
const PERCENT_TYPES = new Set(["conversion_rate", "sla_rate"]);
export const GOAL_STATUS = { current: "Vigente", future: "Futura", ended: "Encerrada" } as const;
export type GoalStatus = (typeof GOAL_STATUS)[keyof typeof GOAL_STATUS];

function goalScopeCondition(auth: Auth): SQL | undefined {
  const { scope, context } = auth;
  const goals = schema.goals;
  const memberships = schema.tenantMemberships;
  const memberIn = (column: SQL) =>
    sql`${goals.scopeId} IN (SELECT ${memberships.userId} FROM ${memberships} WHERE ${memberships.tenantId} = ${context.tenantId} AND ${column})`;
  if (scope.mode === "tenant") return undefined;
  if (scope.mode === "units") {
    const units = [...scope.unitIds];
    const inUnits = sql`${inArray(memberships.branchId, units)}`;
    return or(
      eq(goals.scope, "tenant"),
      and(eq(goals.scope, "branch"), inArray(goals.scopeId, units)),
      and(eq(goals.scope, "broker"), memberIn(inUnits)),
      and(eq(goals.scope, "team"), memberIn(inUnits)),
    );
  }
  if (scope.mode === "owners") {
    const ownTeamAndCompany = or(and(eq(goals.scope, "team"), eq(goals.scopeId, context.userId)), eq(goals.scope, "tenant"));
    return or(and(eq(goals.scope, "broker"), inArray(goals.scopeId, [...scope.ownerIds])), context.role === "supervisor" ? ownTeamAndCompany : undefined);
  }
  return sql`false`;
}

/** Read-only view of existing goals in the caller's ERP scope; never writes goals or progress. */
export async function getScopedGoals() {
  const db = getDatabase();
  const auth = await requireErpAccess("analytics", "erp_view_analytics", db);
  const visibility = analyticsVisibility(auth);
  const { context } = auth;
  const goals = schema.goals;
  const rows = await db
    .select({
      id: goals.id, name: goals.name, scope: goals.scope, scopeId: goals.scopeId, targetType: goals.targetType,
      targetValue: goals.targetValue, period: goals.period, startDate: goals.startDate, endDate: goals.endDate,
      currentValue: schema.goalProgress.currentValue, percentage: schema.goalProgress.percentage, calculatedAt: schema.goalProgress.calculatedAt,
      branchName: schema.branches.name, brokerName: schema.user.name,
    })
    .from(goals)
    .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, goals.id))
    .leftJoin(schema.branches, and(eq(goals.scope, "branch"), eq(schema.branches.id, goals.scopeId), eq(schema.branches.tenantId, context.tenantId)))
    .leftJoin(schema.user, and(sql`${goals.scope} IN ('broker', 'team')`, eq(schema.user.id, goals.scopeId)))
    .where(and(eq(goals.tenantId, context.tenantId), eq(goals.active, true), goalScopeCondition(auth)))
    .orderBy(desc(goals.endDate), asc(goals.name))
    .limit(200);
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
    let status: GoalStatus = GOAL_STATUS.current;
    if (row.endDate.getTime() < now) status = GOAL_STATUS.ended;
    else if (row.startDate.getTime() > now) status = GOAL_STATUS.future;
    const owner = row.scope === "branch" ? row.branchName : row.scope === "tenant" ? null : row.brokerName;
    return {
      id: row.id, name: row.name, scopeLabel: GOAL_SCOPE_LABEL[row.scope], owner, targetType: row.targetType, period: row.period,
      startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(), status, hideMoney,
      target: format(row.targetValue), current: format(row.currentValue), percentage: hideMoney ? null : row.percentage,
      calculatedAt: row.calculatedAt?.toISOString() ?? null,
    };
  });
  await audit(db, auth, "metas", { count: result.length });
  return { rows: result, visibility, generatedAt: new Date().toISOString(), manageHref: drillTarget(access, auth, "/gestao") };
}
