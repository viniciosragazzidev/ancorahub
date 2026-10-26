import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { isMetricGoalType, metricGoalProgress } from "@/features/goals/metric-goals";
import { canonicalWindowBounds } from "@/features/reports/metrics/metric-windows";
import { resolveCanonicalTeamMetrics, type CanonicalTeamMetricRow } from "@/features/reports/metrics/team-metrics-service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { saoPauloDayKey } from "@/features/team-management/health-input";
import { windowValue } from "@/features/team-management/metrics";
import { isBrokerMetricRowVisibleInScope, resolveBrokerMetricsScope, type BrokerMetricsScope } from "@/features/team-management/scope";
import { TtlCache } from "@/shared/cache/ttl-cache";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import {
  PERIOD_WINDOW,
  type BrokerCarrierSales,
  type BrokerGoalInput,
  type BrokerPerformanceData,
  type BrokerPerformancePeriod,
  type BrokerPerformanceSeriesPoint,
  type BrokerPerformanceTotals,
} from "./domain";

const performanceCache = new TtlCache<BrokerPerformanceData>(60_000, 400);
const SAO_PAULO = "America/Sao_Paulo";

export async function isBrokerPerformanceLiteEnabled(): Promise<boolean> {
  return (await getFeatureFlag(FEATURE_FLAGS.BROKER_PERFORMANCE_LITE).catch(() => "false")) === "true";
}

function totalsFromRow(row: CanonicalTeamMetricRow | undefined): BrokerPerformanceTotals {
  const metric = (id: keyof CanonicalTeamMetricRow["metrics"]) => row?.metrics[id] ?? 0;
  return {
    leads: metric("commercial.leads_received"),
    quotes: metric("team.quotes"),
    sales: metric("team.sales"),
    revenue: metric("financial.gross_revenue"),
    slaRate: metric("team.first_contact_sla_rate"),
    slaLeads: metric("team.first_contact_sla_leads"),
  };
}

async function canonicalBrokerRows(context: TenantContext, scope: BrokerMetricsScope, input: { window: 1 | 7 | 30; now: Date }) {
  const snapshot = await resolveCanonicalTeamMetrics(context, scope, input);
  if (snapshot.rows.some((row) => !isBrokerMetricRowVisibleInScope(scope, { ...row, tenantId: snapshot.tenantId }))) {
    throw new Error("A consulta pessoal retornou uma métrica fora do escopo do corretor.");
  }
  return {
    current: snapshot.rows.find((row) => row.windowKey === "current"),
    previous: snapshot.rows.find((row) => row.windowKey === "previous"),
  };
}

/**
 * Totais por dia de São Paulo em 7 e 30 dias, para o insight do melhor dia da semana (Hoje não usa série).
 * Mesmas definições do motor canônico (lead por created_at, cotação por created_at,
 * venda ativa por sale_date), sempre restritas ao próprio corretor.
 */
async function brokerDailySeries(scope: BrokerMetricsScope, window: 7 | 30, now: Date): Promise<BrokerPerformanceSeriesPoint[]> {
  const unit = sql.raw("'day'");
  const startsAt = new Date(canonicalWindowBounds(1, now).current.startsAt.getTime() - (window - 1) * 86_400_000);
  const result = await getDatabase().execute(sql`
    with
    params as (
      select ${scope.tenantId}::text as tenant_id, ${scope.brokerId}::text as broker_id,
        ${startsAt.toISOString()}::timestamptz as starts_at, ${now.toISOString()}::timestamptz as ends_at
    ),
    buckets as (
      select generate_series(
        date_trunc(${unit}, p.starts_at at time zone ${SAO_PAULO}),
        date_trunc(${unit}, p.ends_at at time zone ${SAO_PAULO}),
        interval '1 day'
      ) as bucket
      from params p
    ),
    facts as (
      select date_trunc(${unit}, leads.created_at at time zone ${SAO_PAULO}) as bucket, 1 as leads, 0 as quotes, 0 as sales, 0::numeric as revenue
      from leads cross join params p
      where leads.tenant_id = p.tenant_id and leads.corretor_id = p.broker_id
        and leads.created_at >= p.starts_at and leads.created_at < p.ends_at
        and leads.deleted_at is null and leads.archived_at is null
      union all
      select date_trunc(${unit}, quotes.created_at at time zone ${SAO_PAULO}), 0, 1, 0, 0
      from quotes
      join leads on leads.id = quotes.lead_id and leads.tenant_id = quotes.tenant_id
      cross join params p
      where quotes.tenant_id = p.tenant_id and leads.corretor_id = p.broker_id
        and quotes.created_at >= p.starts_at and quotes.created_at < p.ends_at
        and leads.deleted_at is null and leads.archived_at is null
      union all
      select date_trunc(${unit}, sales.sale_date at time zone ${SAO_PAULO}), 0, 0, 1, sales.sale_value
      from sales
      join leads on leads.id = sales.lead_id and leads.tenant_id = sales.tenant_id
      cross join params p
      where sales.tenant_id = p.tenant_id and sales.broker_id = p.broker_id and sales.status = 'active'
        and sales.sale_date >= p.starts_at and sales.sale_date < p.ends_at
        and leads.deleted_at is null and leads.archived_at is null
    )
    select
      to_char(b.bucket, 'YYYY-MM-DD') as bucket_key,
      extract(dow from b.bucket)::int as weekday,
      coalesce(sum(f.leads), 0)::int as leads,
      coalesce(sum(f.quotes), 0)::int as quotes,
      coalesce(sum(f.sales), 0)::int as sales,
      coalesce(sum(f.revenue), 0)::numeric as revenue
    from buckets b
    left join facts f on f.bucket = b.bucket
    group by b.bucket
    order by b.bucket
  `);
  return (result as unknown as Array<Record<string, unknown>>).map((row) => ({
    key: String(row.bucket_key),
    weekday: Number(row.weekday),
    leads: Number(row.leads ?? 0),
    quotes: Number(row.quotes ?? 0),
    sales: Number(row.sales ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
}

/** Vendas ativas do período por operadora. Origem do lead fica de fora: é oculta ao corretor (2026-10-16). */
async function brokerCarrierSales(scope: BrokerMetricsScope, window: 1 | 7 | 30, now: Date): Promise<BrokerCarrierSales[]> {
  const { current } = canonicalWindowBounds(window, now);
  const result = await getDatabase().execute(sql`
    select coalesce(carriers.name, 'Operadora não informada') as name, count(*)::int as sales, coalesce(sum(sales.sale_value), 0)::numeric as revenue
    from sales
    join leads on leads.id = sales.lead_id and leads.tenant_id = sales.tenant_id
    left join carrier_plans on carrier_plans.id = sales.carrier_plan_id
    left join carriers on carriers.id = carrier_plans.carrier_id
    where sales.tenant_id = ${scope.tenantId} and sales.broker_id = ${scope.brokerId} and sales.status = 'active'
      and sales.sale_date >= ${current.startsAt.toISOString()}::timestamptz and sales.sale_date < ${current.endsAt.toISOString()}::timestamptz
      and leads.deleted_at is null and leads.archived_at is null
    group by 1
    order by 3 desc, 2 desc, 1
    limit 5
  `);
  return (result as unknown as Array<Record<string, unknown>>).map((row) => ({
    name: String(row.name),
    sales: Number(row.sales ?? 0),
    revenue: Math.round(Number(row.revenue ?? 0) * 100) / 100,
  }));
}

/** Meta ativa do corretor hoje. Metas de cotações, SLA e tempo usam o motor canônico no escopo do próprio corretor. */
async function brokerActiveGoal(context: TenantContext, scope: BrokerMetricsScope, now: Date): Promise<BrokerGoalInput | null> {
  const [goal] = await getDatabase()
    .select({
      name: schema.goals.name,
      targetType: schema.goals.targetType,
      targetValue: schema.goals.targetValue,
      endDate: schema.goals.endDate,
      currentValue: schema.goalProgress.currentValue,
      percentage: schema.goalProgress.percentage,
    })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(and(
      eq(schema.goals.tenantId, scope.tenantId),
      eq(schema.goals.scope, "broker"),
      eq(schema.goals.scopeId, scope.brokerId),
      eq(schema.goals.active, true),
      lte(schema.goals.startDate, now),
      gte(schema.goals.endDate, now),
    ))
    .orderBy(asc(schema.goals.endDate))
    .limit(1);
  if (!goal) return null;

  const targetValue = Number(goal.targetValue);
  let current = Number(goal.currentValue ?? 0);
  let percentage = Number(goal.percentage ?? 0);
  if (isMetricGoalType(goal.targetType)) {
    const { current: row } = await canonicalBrokerRows(context, scope, { window: 30, now });
    const progress = metricGoalProgress({ targetType: goal.targetType, targetValue, window: row ? windowValue(row) : null });
    current = progress.current;
    percentage = progress.percentage;
  }
  return { name: goal.name, targetType: goal.targetType, targetValue, current, percentage, endDay: saoPauloDayKey(goal.endDate) };
}

/** Desempenho pessoal do corretor: escopo da sessão, cache de 60 s e auditoria a cada leitura. */
export async function getBrokerPerformance(context: TenantContext, input: { period: BrokerPerformancePeriod; now: Date }): Promise<BrokerPerformanceData> {
  const scope = resolveBrokerMetricsScope(context);
  if (!(await isBrokerPerformanceLiteEnabled())) throw new Error("O Desempenho do corretor está desativado pelo Super Admin.");

  const window = PERIOD_WINDOW[input.period];
  const minuteBucket = Math.floor(input.now.getTime() / 60_000);
  const data = await performanceCache.getOrLoad(`${scope.tenantId}:${scope.brokerId}:${window}:${minuteBucket}`, async () => {
    const [rows, series, carriers, goal] = await Promise.all([
      canonicalBrokerRows(context, scope, { window, now: input.now }),
      window === 1 ? Promise.resolve([]) : brokerDailySeries(scope, window, input.now),
      brokerCarrierSales(scope, window, input.now),
      brokerActiveGoal(context, scope, input.now),
    ]);
    return {
      period: input.period,
      today: saoPauloDayKey(input.now),
      current: totalsFromRow(rows.current),
      previous: totalsFromRow(rows.previous),
      series,
      carriers,
      goal,
    };
  });

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "broker_performance",
    entidadeId: scope.brokerId,
    acao: `broker_performance.viewed:${window}d`,
    createdAt: input.now,
  });
  return data;
}
