import "server-only";

import { and, count, eq, gte, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import type { PeriodValue } from "@/shared/period";
import { periodStart } from "@/shared/period";

import type { FunnelStage } from "./metrics-math";
import { buildFunnelRows, percentage, previousWindowStart, safeRate } from "./metrics-math";
import { resolveReportDataScope, type ReportDataScope } from "./metric-scope";

/** Estágios ativos (não terminais) do funil canônico. */
const ACTIVE_LEAD_STATUSES = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

/** Estágios considerados "negociação avançada" para o item de atenção. */
const NEGOTIATION_STAGES = ["negotiation", "documentation_pending", "under_analysis"] as const;

export interface CohortConversion {
  readonly received: number;
  readonly converted: number;
  readonly lost: number;
  /** Percentual 0–100. */
  readonly rate: number;
}

export interface PeriodWindows {
  readonly currentStart: Date;
  readonly previousStart: Date;
  readonly days: number;
}

export function resolveWindows(period: PeriodValue): PeriodWindows {
  const currentStart = periodStart(period);
  return {
    currentStart,
    previousStart: previousWindowStart(currentStart, period),
    days: period,
  };
}

function cohortWhere(scope: ReportDataScope, start: Date, end?: Date): SQL | undefined {
  return and(
    eq(schema.leads.tenantId, scope.tenantId),
    isNull(schema.leads.deletedAt),
    gte(schema.leads.createdAt, start),
    end ? lt(schema.leads.createdAt, end) : undefined,
    scope.leadScope,
  );
}

/**
 * Filtro canônico de vendas: sempre join com leads para aplicar o escopo de
 * unidade do gestor e o escopo de corretor/supervisor em ambas as pontas.
 */
function salesJoinedWhere(scope: ReportDataScope, start: Date, end?: Date): SQL | undefined {
  return and(
    eq(schema.sales.tenantId, scope.tenantId),
    eq(schema.leads.tenantId, scope.tenantId),
    eq(schema.sales.status, "active"),
    gte(schema.sales.saleDate, start),
    end ? lt(schema.sales.saleDate, end) : undefined,
    scope.leadScope,
    scope.salesBrokerScope,
  );
}

/** SLA operacional do tenant (parâmetros existentes, DEC-090 §7). */
export interface TenantSlaParams {
  readonly firstContactMinutes: number;
  readonly stagnantDays: number;
}

export async function getTenantSlaParams(tenantId: string): Promise<TenantSlaParams> {
  const rows = await getDatabase()
    .select({
      firstContactMinutes: schema.tenants.slaFirstContactMinutes,
      stagnantDays: schema.tenants.slaStagnantDays,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  const first = Number.parseInt(rows[0]?.firstContactMinutes ?? "15", 10);
  const stagnant = Number.parseInt(rows[0]?.stagnantDays ?? "3", 10);
  return {
    firstContactMinutes: Number.isFinite(first) && first > 0 ? first : 15,
    stagnantDays: Number.isFinite(stagnant) && stagnant > 0 ? stagnant : 3,
  };
}

/**
 * `commercial.conversion_rate` — coorte de entrada (DEC-090).
 * Definição canônica consumível por qualquer superfície; nunca recalcular.
 */
export async function resolveCohortConversion(
  context: TenantContext,
  start: Date,
  end?: Date,
): Promise<CohortConversion> {
  const scope = await resolveReportDataScope(context);
  const rows = await getDatabase()
    .select({ status: schema.leads.status, total: count() })
    .from(schema.leads)
    .where(cohortWhere(scope, start, end))
    .groupBy(schema.leads.status);

  let received = 0;
  let converted = 0;
  let lost = 0;
  for (const row of rows) {
    received += Number(row.total);
    if (row.status === "converted") converted += Number(row.total);
    if (row.status === "lost") lost += Number(row.total);
  }

  return { received, converted, lost, rate: percentage(converted, received) };
}

export interface CommercialOverview {
  readonly conversion: CohortConversion;
  readonly previousConversion: CohortConversion;
  readonly sales: number;
  readonly previousSales: number;
  readonly revenue: number | null;
  readonly previousRevenue: number | null;
  readonly avgTicket: number | null;
  readonly previousAvgTicket: number | null;
}

export async function getCommercialOverview(
  context: TenantContext,
  period: PeriodValue,
  options: { includeFinancial: boolean },
): Promise<CommercialOverview> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const { currentStart, previousStart } = resolveWindows(period);

  const [conversion, previousConversion] = await Promise.all([
    resolveCohortConversion(context, currentStart),
    resolveCohortConversion(context, previousStart, currentStart),
  ]);

  const currentSalesWhere = salesJoinedWhere(scope, currentStart);
  const previousSalesWhere = salesJoinedWhere(scope, previousStart, currentStart);

  const [salesRow, previousSalesRow, revenueRow, previousRevenueRow] = await Promise.all([
    db.select({ total: count() }).from(schema.sales).innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id)).where(currentSalesWhere),
    db.select({ total: count() }).from(schema.sales).innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id)).where(previousSalesWhere),
    options.includeFinancial
      ? db
          .select({ total: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`, count: count() })
          .from(schema.sales)
          .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
          .where(currentSalesWhere)
      : Promise.resolve(null),
    options.includeFinancial
      ? db
          .select({ total: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`, count: count() })
          .from(schema.sales)
          .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
          .where(previousSalesWhere)
      : Promise.resolve(null),
  ]);

  const sales = Number(salesRow[0]?.total ?? 0);
  const previousSales = Number(previousSalesRow[0]?.total ?? 0);
  const revenue = revenueRow ? Number(revenueRow[0]?.total ?? 0) : null;
  const revenueCount = revenueRow ? Number(revenueRow[0]?.count ?? 0) : 0;
  const previousRevenue = previousRevenueRow ? Number(previousRevenueRow[0]?.total ?? 0) : null;
  const previousRevenueCount = previousRevenueRow ? Number(previousRevenueRow[0]?.count ?? 0) : 0;

  return {
    conversion,
    previousConversion,
    sales,
    previousSales,
    revenue,
    previousRevenue,
    avgTicket: revenue !== null ? (revenueCount > 0 ? revenue / revenueCount : 0) : null,
    previousAvgTicket:
      previousRevenue !== null
        ? previousRevenueCount > 0
          ? previousRevenue / previousRevenueCount
          : 0
        : null,
  };
}

export interface FunnelSnapshot {
  readonly rows: readonly {
    stage: FunnelStage;
    inStage: number;
    reached: number;
    progressionToNext: number | null;
  }[];
  readonly lost: number;
  readonly biggestBottleneck: number | null;
  readonly received: number;
}

export async function getFunnelSnapshot(
  context: TenantContext,
  period: PeriodValue,
): Promise<FunnelSnapshot> {
  const scope = await resolveReportDataScope(context);
  const { currentStart } = resolveWindows(period);

  const rows = await getDatabase()
    .select({ status: schema.leads.status, total: count() })
    .from(schema.leads)
    .where(cohortWhere(scope, currentStart))
    .groupBy(schema.leads.status);

  const statusCounts: Record<string, number> = {};
  let received = 0;
  for (const row of rows) {
    statusCounts[row.status] = Number(row.total);
    received += Number(row.total);
  }

  const funnel = buildFunnelRows(statusCounts);
  return {
    rows: funnel.rows,
    lost: funnel.lost,
    biggestBottleneck: funnel.biggestBottleneck,
    received,
  };
}

export interface SourcePerformanceRow {
  readonly source: string;
  readonly leads: number;
  readonly converted: number;
  readonly sales: number;
  readonly revenue: number | null;
}

const SOURCE_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  meta_lead_ads: "Meta Lead Ads",
  manual: "Cadastro manual",
  webhook: "Webhook",
  extension: "Extensão de navegador",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export async function getCommercialBySource(
  context: TenantContext,
  period: PeriodValue,
  options: { includeFinancial: boolean },
): Promise<SourcePerformanceRow[]> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const { currentStart } = resolveWindows(period);

  const [leadRows, saleRows] = await Promise.all([
    db
      .select({
        source: schema.leads.sourceChannel,
        total: count(),
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
      })
      .from(schema.leads)
      .where(cohortWhere(scope, currentStart))
      .groupBy(schema.leads.sourceChannel),
    db
      .select({
        source: schema.leads.sourceChannel,
        total: count(),
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(salesJoinedWhere(scope, currentStart))
      .groupBy(schema.leads.sourceChannel),
  ]);

  const salesBySource = new Map(
    saleRows.map((row) => [row.source, { sales: Number(row.total), revenue: Number(row.revenue) }]),
  );

  return leadRows
    .map((row) => {
      const sales = salesBySource.get(row.source);
      return {
        source: row.source,
        leads: Number(row.total),
        converted: Number(row.converted),
        sales: sales?.sales ?? 0,
        revenue: options.includeFinancial ? (sales?.revenue ?? 0) : null,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export interface AttentionItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly count: number;
  /** Rota de drill-down com a população exata. */
  readonly href: string;
}

export interface AttentionSnapshot {
  readonly items: readonly AttentionItem[];
  readonly sla: TenantSlaParams;
}

export async function getAttentionSnapshot(
  context: TenantContext,
  period: PeriodValue,
): Promise<AttentionSnapshot> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const { currentStart } = resolveWindows(period);
  const sla = await getTenantSlaParams(context.tenantId);
  const slaSeconds = sla.firstContactMinutes * 60;
  const stagnantCutoff = sql`now() - (${sla.stagnantDays} * interval '1 day')`;

  const [hotUnassigned, outOfSla, stale, overCapacity] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, scope.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.corretorId),
          eq(schema.leads.qualificationStatus, "hot"),
          ne(schema.leads.status, "lost"),
          ne(schema.leads.status, "converted"),
          scope.leadScope,
        ),
      ),
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, scope.tenantId),
          isNull(schema.leads.deletedAt),
          isNotNull(schema.leads.corretorId),
          gte(schema.leads.assignedAt, currentStart),
          sql`(
            (${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} < now() - (${sla.firstContactMinutes} * interval '1 minute'))
            or ${schema.leads.firstContactLatencySeconds} > ${slaSeconds}
          )`,
          scope.leadScope,
        ),
      ),
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, scope.tenantId),
          isNull(schema.leads.deletedAt),
          inArray(schema.leads.status, [...NEGOTIATION_STAGES]),
          lt(schema.leads.stageEnteredAt, stagnantCutoff),
          scope.leadScope,
        ),
      ),
    resolveBrokersOverCapacity(context, scope),
  ]);

  const periodQuery = `?period=${period}`;

  return {
    sla,
    items: [
      {
        id: "high-intent-unassigned",
        title: "Leads com alta intenção aguardando corretor",
        description: "Qualificação hot sem corretor responsável.",
        count: Number(hotUnassigned[0]?.total ?? 0),
        href: `/relatorios/drill/high-intent-unassigned${periodQuery}`,
      },
      {
        id: "out-of-sla",
        title: "Primeiro atendimento fora do SLA",
        description: `Distribuídos no período com latência acima de ${sla.firstContactMinutes} min ou sem contato dentro do prazo.`,
        count: Number(outOfSla[0]?.total ?? 0),
        href: `/relatorios/drill/out-of-sla${periodQuery}`,
      },
      {
        id: "stale-negotiations",
        title: "Negociações paradas",
        description: `Sem avanço de etapa há mais de ${sla.stagnantDays} dias.`,
        count: Number(stale[0]?.total ?? 0),
        href: `/relatorios/drill/stale-negotiations${periodQuery}`,
      },
      {
        id: "brokers-over-capacity",
        title: "Corretores acima da capacidade",
        description: "Carteira ativa acima da capacidade da fila responsável.",
        count: overCapacity.length,
        href: `/relatorios/drill/brokers-over-capacity${periodQuery}`,
      },
    ],
  };
}

export interface BrokerCapacityRow {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly activeLeads: number;
  readonly capacity: number;
}

async function resolveBrokersOverCapacity(
  context: TenantContext,
  scope: ReportDataScope,
): Promise<BrokerCapacityRow[]> {
  const db = getDatabase();

  const queueRows = await db
    .select({
      id: schema.leadQueues.id,
      capacity: schema.leadQueues.capacityPerBroker,
    })
    .from(schema.leadQueues)
    .where(
      and(
        eq(schema.leadQueues.tenantId, context.tenantId),
        eq(schema.leadQueues.capacityEnabled, true),
        eq(schema.leadQueues.status, "active"),
        isNull(schema.leadQueues.deletedAt),
      ),
    );

  const capacities = new Map(
    queueRows
      .filter((row) => row.capacity !== null && (row.capacity as number) > 0)
      .map((row) => [row.id, row.capacity as number]),
  );
  if (capacities.size === 0) return [];

  const loadRows = await db
    .select({
      brokerId: schema.leads.corretorId,
      brokerName: schema.user.name,
      queueId: schema.leads.queueId,
      total: count(),
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .where(
      and(
        eq(schema.leads.tenantId, scope.tenantId),
        isNull(schema.leads.deletedAt),
        isNotNull(schema.leads.corretorId),
        inArray(schema.leads.status, [...ACTIVE_LEAD_STATUSES]),
        scope.leadScope,
        inArray(schema.leads.queueId, [...capacities.keys()]),
      ),
    )
    .groupBy(schema.leads.corretorId, schema.user.name, schema.leads.queueId);

  const byBroker = new Map<string, { name: string; active: number; capacity: number }>();
  for (const row of loadRows) {
    if (!row.brokerId || !row.queueId) continue;
    const capacity = capacities.get(row.queueId) ?? 0;
    const entry = byBroker.get(row.brokerId) ?? {
      name: row.brokerName ?? "Corretor removido",
      active: 0,
      capacity: 0,
    };
    entry.active += Number(row.total);
    entry.capacity = Math.max(entry.capacity, capacity);
    byBroker.set(row.brokerId, entry);
  }

  return [...byBroker.entries()]
    .filter(([, entry]) => entry.capacity > 0 && entry.active > entry.capacity)
    .map(([brokerId, entry]) => ({
      brokerId,
      brokerName: entry.name,
      activeLeads: entry.active,
      capacity: entry.capacity,
    }))
    .sort((a, b) => b.activeLeads - a.activeLeads);
}

export interface BrokerPerformanceRow {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly received: number;
  readonly worked: number;
  readonly converted: number;
  readonly lost: number;
  readonly qualified: number;
  readonly contacted: number;
  readonly withinSla: number;
  readonly avgFirstContactSeconds: number | null;
  readonly sales: number;
  readonly revenue: number | null;
  readonly avgCycleDays: number | null;
  readonly stagnant: number;
  readonly conversionRate: number;
  readonly slaRate: number;
}

export async function getTeamPerformance(
  context: TenantContext,
  period: PeriodValue,
  options: { includeFinancial: boolean },
): Promise<BrokerPerformanceRow[]> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const sla = await getTenantSlaParams(context.tenantId);
  const { currentStart } = resolveWindows(period);
  const slaSeconds = sla.firstContactMinutes * 60;
  const stagnantCutoff = sql`now() - (${sla.stagnantDays} * interval '1 day')`;

  const [cohortRows, saleRows, stagnantRows] = await Promise.all([
    db
      .select({
        brokerId: schema.leads.corretorId,
        brokerName: schema.user.name,
        received: count(),
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
        lost: sql<number>`count(*) filter (where ${schema.leads.status} = 'lost')`,
        worked: sql<number>`count(*) filter (where ${schema.leads.serviceStartedAt} is not null)`,
        qualified: sql<number>`count(*) filter (where ${schema.leads.qualificationStatus} in ('hot', 'warm'))`,
        contacted: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} is not null)`,
        withinSla: sql<number>`count(*) filter (where ${schema.leads.firstContactLatencySeconds} is not null and ${schema.leads.firstContactLatencySeconds} <= ${slaSeconds})`,
        avgLatency: sql<number | null>`avg(${schema.leads.firstContactLatencySeconds})`,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .where(and(cohortWhere(scope, currentStart), isNotNull(schema.leads.corretorId)))
      .groupBy(schema.leads.corretorId, schema.user.name),
    db
      .select({
        brokerId: schema.sales.brokerId,
        sales: count(),
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
        avgCycleDays: sql<number | null>`avg(extract(epoch from (${schema.sales.saleDate} - ${schema.leads.createdAt})) / 86400)`,
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(salesJoinedWhere(scope, currentStart))
      .groupBy(schema.sales.brokerId),
    db
      .select({ brokerId: schema.leads.corretorId, total: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, scope.tenantId),
          isNull(schema.leads.deletedAt),
          isNotNull(schema.leads.corretorId),
          inArray(schema.leads.status, [...NEGOTIATION_STAGES]),
          lt(schema.leads.stageEnteredAt, stagnantCutoff),
          scope.leadScope,
        ),
      )
      .groupBy(schema.leads.corretorId),
  ]);

  const salesByBroker = new Map(saleRows.map((row) => [row.brokerId, row]));
  const stagnantByBroker = new Map(
    stagnantRows.map((row) => [row.brokerId as string, Number(row.total)]),
  );

  return cohortRows
    .map((row) => {
      const brokerId = row.brokerId as string;
      const received = Number(row.received);
      const converted = Number(row.converted);
      const contacted = Number(row.contacted);
      const withinSla = Number(row.withinSla);
      const sales = salesByBroker.get(brokerId);
      return {
        brokerId,
        brokerName: row.brokerName ?? "Corretor removido",
        received,
        worked: Number(row.worked),
        converted,
        lost: Number(row.lost),
        qualified: Number(row.qualified),
        contacted,
        withinSla,
        avgFirstContactSeconds: row.avgLatency === null ? null : Number(row.avgLatency),
        sales: sales ? Number(sales.sales) : 0,
        revenue: options.includeFinancial && sales ? Number(sales.revenue) : null,
        avgCycleDays: sales?.avgCycleDays == null ? null : Number(sales.avgCycleDays),
        stagnant: stagnantByBroker.get(brokerId) ?? 0,
        conversionRate: percentage(converted, received),
        slaRate: percentage(withinSla, contacted),
      };
    })
    .sort((a, b) => b.received - a.received);
}

export interface UnitPerformanceRow {
  readonly branchId: string;
  readonly branchName: string;
  readonly leads: number;
  readonly converted: number;
  readonly conversionRate: number;
  readonly sales: number;
  readonly contacted: number;
  readonly withinSla: number;
  readonly slaRate: number;
  readonly avgFirstContactSeconds: number | null;
}

export async function getUnitPerformance(
  context: TenantContext,
  period: PeriodValue,
): Promise<UnitPerformanceRow[]> {
  const scope = await resolveReportDataScope(context);
  if (!scope.canSeeUnits) return [];

  const db = getDatabase();
  const sla = await getTenantSlaParams(context.tenantId);
  const { currentStart } = resolveWindows(period);
  const slaSeconds = sla.firstContactMinutes * 60;

  const [cohortRows, saleRows] = await Promise.all([
    db
      .select({
        branchId: schema.leads.branchId,
        branchName: schema.branches.name,
        leads: count(),
        converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
        contacted: sql<number>`count(*) filter (where ${schema.leads.firstContactAt} is not null)`,
        withinSla: sql<number>`count(*) filter (where ${schema.leads.firstContactLatencySeconds} is not null and ${schema.leads.firstContactLatencySeconds} <= ${slaSeconds})`,
        avgLatency: sql<number | null>`avg(${schema.leads.firstContactLatencySeconds})`,
      })
      .from(schema.leads)
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .where(and(cohortWhere(scope, currentStart), isNotNull(schema.leads.branchId)))
      .groupBy(schema.leads.branchId, schema.branches.name),
    db
      .select({ branchId: schema.leads.branchId, sales: count() })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(salesJoinedWhere(scope, currentStart))
      .groupBy(schema.leads.branchId),
  ]);

  const salesByBranch = new Map(
    saleRows.map((row) => [row.branchId as string, Number(row.sales)]),
  );

  return cohortRows
    .map((row) => {
      const leads = Number(row.leads);
      const converted = Number(row.converted);
      const contacted = Number(row.contacted);
      const withinSla = Number(row.withinSla);
      return {
        branchId: row.branchId as string,
        branchName: row.branchName ?? "Sem unidade",
        leads,
        converted,
        conversionRate: percentage(converted, leads),
        sales: salesByBranch.get(row.branchId as string) ?? 0,
        contacted,
        withinSla,
        slaRate: percentage(withinSla, contacted),
        avgFirstContactSeconds: row.avgLatency === null ? null : Number(row.avgLatency),
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export interface FinancialOverview {
  readonly sales: number;
  readonly revenue: number;
  readonly avgTicket: number;
  readonly byUnit: readonly { label: string; revenue: number; sales: number }[];
  readonly byBroker: readonly { label: string; revenue: number; sales: number }[];
  readonly bySource: readonly { label: string; revenue: number; sales: number }[];
}

export async function getFinancialOverview(
  context: TenantContext,
  period: PeriodValue,
): Promise<FinancialOverview> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const { currentStart } = resolveWindows(period);
  const salesScope = salesJoinedWhere(scope, currentStart);

  const [totals, byUnit, byBroker, bySource] = await Promise.all([
    db
      .select({
        sales: count(),
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(salesScope),
    db
      .select({
        label: sql<string>`coalesce(${schema.branches.name}, 'Sem unidade')`,
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
        sales: count(),
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .where(salesScope)
      .groupBy(sql`coalesce(${schema.branches.name}, 'Sem unidade')`),
    db
      .select({
        label: sql<string>`coalesce(${schema.user.name}, 'Corretor removido')`,
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
        sales: count(),
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .leftJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
      .where(salesScope)
      .groupBy(sql`coalesce(${schema.user.name}, 'Corretor removido')`),
    db
      .select({
        label: sql<string>`coalesce(${schema.leads.sourceChannel}, 'outros')`,
        revenue: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
        sales: count(),
      })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(salesScope)
      .groupBy(sql`coalesce(${schema.leads.sourceChannel}, 'outros')`),
  ]);

  const sales = Number(totals[0]?.sales ?? 0);
  const revenue = Number(totals[0]?.revenue ?? 0);
  const normalize = (rows: { label: string; revenue: string; sales: number }[]) =>
    rows
      .map((row) => ({ label: row.label, revenue: Number(row.revenue), sales: Number(row.sales) }))
      .sort((a, b) => b.revenue - a.revenue);

  return {
    sales,
    revenue,
    avgTicket: sales > 0 ? revenue / sales : 0,
    byUnit: normalize(byUnit),
    byBroker: normalize(byBroker),
    bySource: normalize(bySource).map((row) => ({ ...row, label: sourceLabel(row.label) })),
  };
}

export const DRILLDOWN_IDS = [
  "converted",
  "not-converted",
  "lost",
  "out-of-sla",
  "stale-negotiations",
  "high-intent-unassigned",
  "brokers-over-capacity",
] as const;

export type DrilldownId = (typeof DRILLDOWN_IDS)[number];

export function isDrilldownId(raw: unknown): raw is DrilldownId {
  return typeof raw === "string" && (DRILLDOWN_IDS as readonly string[]).includes(raw);
}

export interface DrilldownLeadRow {
  readonly id: string;
  readonly nome: string;
  readonly status: string;
  readonly brokerName: string | null;
  readonly branchName: string | null;
  readonly createdAt: Date;
  readonly firstContactAt: Date | null;
  readonly latencySeconds: number | null;
}

export interface DrilldownBrokerRow {
  readonly brokerId: string;
  readonly brokerName: string;
  readonly activeLeads: number;
  readonly capacity: number;
}

export interface DrilldownResult {
  readonly id: DrilldownId;
  readonly title: string;
  readonly explanation: string;
  readonly total: number;
  readonly rows: readonly DrilldownLeadRow[];
  readonly brokers: readonly DrilldownBrokerRow[];
}

const DRILLDOWN_META: Record<DrilldownId, { title: string; explanation: string }> = {
  converted: {
    title: "Leads convertidos",
    explanation:
      "Leads recebidos no período que alcançaram o estágio `converted` — numerador da taxa de conversão (coorte de entrada).",
  },
  "not-converted": {
    title: "Leads não convertidos",
    explanation:
      "Leads recebidos no período que ainda não alcançaram `converted` — denominador menos numerador da taxa de conversão.",
  },
  lost: {
    title: "Leads perdidos",
    explanation: "Leads recebidos no período com status `lost`.",
  },
  "out-of-sla": {
    title: "Primeiro atendimento fora do SLA",
    explanation:
      "Leads distribuídos no período com latência de primeiro contato acima do SLA do tenant ou sem contato dentro do prazo.",
  },
  "stale-negotiations": {
    title: "Negociações paradas",
    explanation:
      "Leads em negociação, documentação ou análise cuja entrada na etapa atual excede o prazo de estagnação do tenant.",
  },
  "high-intent-unassigned": {
    title: "Alta intenção sem corretor",
    explanation: "Leads ativos com qualificação hot e sem corretor responsável.",
  },
  "brokers-over-capacity": {
    title: "Corretores acima da capacidade",
    explanation:
      "Corretores cujo número de leads ativos excede a capacidade configurada na fila responsável.",
  },
};

const DRILLDOWN_LIMIT = 200;

export async function getDrilldown(
  context: TenantContext,
  id: DrilldownId,
  period: PeriodValue,
): Promise<DrilldownResult> {
  const scope = await resolveReportDataScope(context);
  const db = getDatabase();
  const sla = await getTenantSlaParams(context.tenantId);
  const { currentStart } = resolveWindows(period);
  const slaSeconds = sla.firstContactMinutes * 60;
  const stagnantCutoff = sql`now() - (${sla.stagnantDays} * interval '1 day')`;
  const meta = DRILLDOWN_META[id];

  if (id === "brokers-over-capacity") {
    const brokers = await resolveBrokersOverCapacity(context, scope);
    return {
      id,
      title: meta.title,
      explanation: meta.explanation,
      total: brokers.length,
      rows: [],
      brokers,
    };
  }

  let where: SQL | undefined;
  switch (id) {
    case "converted":
      where = and(cohortWhere(scope, currentStart), eq(schema.leads.status, "converted"));
      break;
    case "not-converted":
      where = and(cohortWhere(scope, currentStart), ne(schema.leads.status, "converted"));
      break;
    case "lost":
      where = and(cohortWhere(scope, currentStart), eq(schema.leads.status, "lost"));
      break;
    case "out-of-sla":
      where = and(
        eq(schema.leads.tenantId, scope.tenantId),
        isNull(schema.leads.deletedAt),
        isNotNull(schema.leads.corretorId),
        gte(schema.leads.assignedAt, currentStart),
        sql`(
          (${schema.leads.firstContactAt} is null and ${schema.leads.assignedAt} < now() - (${sla.firstContactMinutes} * interval '1 minute'))
          or ${schema.leads.firstContactLatencySeconds} > ${slaSeconds}
        )`,
        scope.leadScope,
      );
      break;
    case "stale-negotiations":
      where = and(
        eq(schema.leads.tenantId, scope.tenantId),
        isNull(schema.leads.deletedAt),
        inArray(schema.leads.status, [...NEGOTIATION_STAGES]),
        lt(schema.leads.stageEnteredAt, stagnantCutoff),
        scope.leadScope,
      );
      break;
    case "high-intent-unassigned":
      where = and(
        eq(schema.leads.tenantId, scope.tenantId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.corretorId),
        eq(schema.leads.qualificationStatus, "hot"),
        ne(schema.leads.status, "lost"),
        ne(schema.leads.status, "converted"),
        scope.leadScope,
      );
      break;
  }

  const [leadRows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        status: schema.leads.status,
        brokerName: schema.user.name,
        branchName: schema.branches.name,
        createdAt: schema.leads.createdAt,
        firstContactAt: schema.leads.firstContactAt,
        latencySeconds: schema.leads.firstContactLatencySeconds,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .where(where)
      .orderBy(sql`${schema.leads.createdAt} desc`)
      .limit(DRILLDOWN_LIMIT),
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(where),
  ]);

  return {
    id,
    title: meta.title,
    explanation: meta.explanation,
    total: Number(totalRow[0]?.total ?? 0),
    rows: leadRows,
    brokers: [],
  };
}

/** Taxa de SLA canônica derivada de contagens (uso compartilhado UI). */
export function slaRate(withinSla: number, contacted: number): number {
  return safeRate(withinSla, contacted) * 100;
}
