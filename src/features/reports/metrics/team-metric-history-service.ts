import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { resolveTeamMetricsScope } from "@/features/team-management/scope";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getMetricDefinition } from "./metric-catalog";
import { isMissingBrokerMetricDailyTable, monthlyBrokerMetricTimeline, type MonthlyBrokerMetricPoint } from "@/features/team-management/g6-pure";

const SNAPSHOT_METRIC_IDS = [
  "commercial.leads_received", "commercial.leads_converted", "commercial.conversion_rate",
  "team.offers_received", "team.offers_accepted", "team.acceptance_rate", "team.median_acceptance_time",
  "team.redistributions", "team.first_contact_sla_rate", "team.first_contact_sla_leads", "team.active_leads",
  "team.overdue_returns", "team.critical_overdue_returns", "team.leads_without_next_action", "team.quotes",
  "team.sales", "team.losses", "team.last_activity_at",
] as const;

export type BrokerMetricTimeline = { available: boolean; points: MonthlyBrokerMetricPoint[] };

/** Read monthly canonical snapshots only after revalidating current unit/team membership in the session scope. */
export async function getBrokerMetricTimeline(context: TenantContext, brokerId: string): Promise<BrokerMetricTimeline> {
  if (await getFeatureFlag(FEATURE_FLAGS.TEAM_MANAGEMENT).catch(() => "false") !== "true") return { available: false, points: [] };
  const scope = resolveTeamMetricsScope(context);
  const membershipScope = scope.kind === "unit"
    ? and(eq(schema.tenantMemberships.branchId, scope.branchId), eq(schema.tenantMemberships.tenantId, scope.tenantId))
    : and(eq(schema.tenantMemberships.supervisorId, scope.supervisorId), eq(schema.tenantMemberships.tenantId, scope.tenantId));
  const [member] = await getDatabase().select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(membershipScope, eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active")))
    .limit(1);
  if (!member) return { available: false, points: [] };
  for (const metricId of SNAPSHOT_METRIC_IDS) {
    if (!getMetricDefinition(metricId)) throw new Error(`Metrica canonica ausente do catalogo: ${metricId}.`);
  }

  const rowScope = scope.kind === "unit"
    ? sql`and branch_id = ${scope.branchId}`
    : sql`and supervisor_id = ${scope.supervisorId}`;
  try {
    const result = await getDatabase().execute(sql`
      select snapshot_day::text as "snapshotDay", metrics
      from broker_metric_daily
      where tenant_id = ${scope.tenantId}
        and broker_id = ${brokerId}
        ${rowScope}
        and snapshot_day >= ((now() at time zone 'America/Sao_Paulo')::date - 89)
        and snapshot_day <= (now() at time zone 'America/Sao_Paulo')::date
      order by snapshot_day
    `);
    const rows = result as unknown as Array<{ snapshotDay: string; metrics: Record<string, number | string | null> }>;
    return { available: true, points: monthlyBrokerMetricTimeline(rows) };
  } catch (error) {
    if (isMissingBrokerMetricDailyTable(error)) return { available: false, points: [] };
    throw error;
  }
}

/** One SQL statement fills missing daily snapshots for the last 90 Sao Paulo days from canonical event facts. */
export async function backfillBrokerMetricDailySnapshots(now = new Date()): Promise<{ inserted: number }> {
  for (const metricId of SNAPSHOT_METRIC_IDS) {
    if (!getMetricDefinition(metricId)) throw new Error(`Metrica canonica ausente do catalogo: ${metricId}.`);
  }
  const [missingLatest] = await getDatabase().execute(sql`
    select exists (
      select 1 from tenant_memberships tm join "user" u on u.id = tm.user_id and u.active = true
      where tm.role = 'broker' and tm.status = 'active'
        and not exists (
          select 1 from broker_metric_daily saved
          where saved.tenant_id = tm.tenant_id and saved.broker_id = tm.user_id
            and saved.snapshot_day = ((${now}::timestamptz at time zone 'America/Sao_Paulo')::date - 1)
        )
    ) as has_missing
  `);
  if (missingLatest?.has_missing !== true) return { inserted: 0 };
  const result = await getDatabase().execute(sql`
    with
    clock as (
      select ((${now}::timestamptz at time zone 'America/Sao_Paulo')::date - 1) as latest_day
    ),
    days as (
      select generated::date as snapshot_day
      from clock c cross join lateral generate_series(c.latest_day - 89, c.latest_day, interval '1 day') generated
    ),
    roster as (
      select tm.tenant_id, tm.user_id as broker_id, tm.branch_id, tm.supervisor_id,
        case when t.sla_first_contact_minutes ~ '^[0-9]+$' and t.sla_first_contact_minutes::int > 0 then t.sla_first_contact_minutes::int else 15 end as sla_minutes
      from tenant_memberships tm
      join tenants t on t.id = tm.tenant_id
      join "user" u on u.id = tm.user_id and u.active = true
      where tm.role = 'broker' and tm.status = 'active'
    ),
    missing as (
      select r.*, d.snapshot_day, d.snapshot_day - 6 as window_start, d.snapshot_day + 1 as window_end
      from roster r cross join days d
      where not exists (
        select 1 from broker_metric_daily saved
        where saved.tenant_id = r.tenant_id and saved.broker_id = r.broker_id and saved.snapshot_day = d.snapshot_day
      )
    ),
    offers as (
      select m.tenant_id, m.broker_id, m.snapshot_day,
        count(o.id) filter (where l.id is not null and o.status not in ('CANCELLED', 'LOST'))::int as offers_received,
        count(o.id) filter (where l.id is not null and o.status not in ('CANCELLED', 'LOST') and o.accepted_at is not null)::int as offers_accepted,
        count(o.id) filter (where l.id is not null and o.status in ('EXPIRED', 'DECLINED', 'REPLACED'))::int as redistributions,
        percentile_cont(0.5) within group (order by extract(epoch from (o.accepted_at - o.offered_at)))
          filter (where l.id is not null and o.status not in ('CANCELLED', 'LOST') and o.accepted_at is not null and o.accepted_at >= o.offered_at) as median_acceptance_seconds
      from missing m left join lead_offers o on o.tenant_id = m.tenant_id and o.broker_id = m.broker_id
        and o.offered_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo')
        and o.offered_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo')
      left join leads l on l.tenant_id = o.tenant_id and l.id = o.lead_id and l.deleted_at is null and l.archived_at is null
      group by m.tenant_id, m.broker_id, m.snapshot_day
    ),
    lead_events as (
      select m.tenant_id, m.broker_id, m.snapshot_day,
        count(l.id) filter (where l.created_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.created_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo'))::int as cohort_received,
        count(l.id) filter (where l.created_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.created_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo') and l.status = 'converted')::int as converted,
        count(l.id) filter (where l.created_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.created_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo') and l.status = 'lost')::int as losses,
        count(l.id) filter (where l.assigned_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.assigned_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo'))::int as sla_assigned,
        count(l.id) filter (where l.assigned_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.assigned_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo') and l.first_contact_at is not null and l.first_contact_at <= l.assigned_at + (m.sla_minutes * interval '1 minute'))::int as sla_within
      from missing m left join leads l on l.tenant_id = m.tenant_id and l.corretor_id = m.broker_id
        and l.deleted_at is null and l.archived_at is null
        and (l.created_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.created_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo')
          or l.assigned_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and l.assigned_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo'))
      group by m.tenant_id, m.broker_id, m.snapshot_day
    ),
    quote_rollup as (
      select m.tenant_id, m.broker_id, m.snapshot_day, count(q.id)::int as quote_count
      from missing m left join leads l on l.tenant_id = m.tenant_id and l.corretor_id = m.broker_id and l.deleted_at is null and l.archived_at is null
      left join quotes q on q.tenant_id = m.tenant_id and q.lead_id = l.id
        and q.created_at >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and q.created_at < (m.window_end::timestamp at time zone 'America/Sao_Paulo')
      group by m.tenant_id, m.broker_id, m.snapshot_day
    ),
    sales_rollup as (
      select m.tenant_id, m.broker_id, m.snapshot_day, count(s.id)::int as sales_count
      from missing m left join sales s on s.tenant_id = m.tenant_id and s.broker_id = m.broker_id and s.status = 'active'
        and s.sale_date >= (m.window_start::timestamp at time zone 'America/Sao_Paulo') and s.sale_date < (m.window_end::timestamp at time zone 'America/Sao_Paulo')
      left join leads sale_lead on sale_lead.tenant_id = s.tenant_id and sale_lead.id = s.lead_id and sale_lead.deleted_at is null and sale_lead.archived_at is null
      where s.id is null or sale_lead.id is not null
      group by m.tenant_id, m.broker_id, m.snapshot_day
    ),
    state_rollup as (
      select m.tenant_id, m.broker_id,
        count(distinct l.id) filter (where l.status in ('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis'))::int as active_leads,
        count(task.id) filter (where task.completed_at is null and task.due_at < ${now}::timestamptz)::int as overdue_returns,
        count(task.id) filter (where task.completed_at is null and task.due_at < ${now}::timestamptz and task.priority = 'urgent')::int as critical_overdue_returns,
        count(l.id) filter (where l.status in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis') and task.id is null)::int as leads_without_next_action
      from missing m
      left join leads l on l.tenant_id = m.tenant_id and l.corretor_id = m.broker_id and l.deleted_at is null and l.archived_at is null
        and l.status in ('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
      left join lead_tasks task on task.tenant_id = m.tenant_id and task.lead_id = l.id and task.completed_at is null
      where m.snapshot_day = (select latest_day from clock)
      group by m.tenant_id, m.broker_id
    )
    insert into broker_metric_daily (id, tenant_id, broker_id, branch_id, supervisor_id, snapshot_day, window_start, window_end, metrics, created_at)
    select gen_random_uuid()::text, m.tenant_id, m.broker_id, m.branch_id, m.supervisor_id, m.snapshot_day, m.window_start, m.window_end,
      jsonb_build_object(
        'commercial.leads_received', coalesce(l.cohort_received, 0),
        'commercial.leads_converted', coalesce(l.converted, 0),
        'commercial.conversion_rate', case when coalesce(l.cohort_received, 0) > 0 then coalesce(l.converted, 0)::numeric * 100 / l.cohort_received else 0 end,
        'team.offers_received', coalesce(o.offers_received, 0),
        'team.offers_accepted', coalesce(o.offers_accepted, 0),
        'team.acceptance_rate', case when coalesce(o.offers_received, 0) > 0 then coalesce(o.offers_accepted, 0)::numeric * 100 / o.offers_received else 0 end,
        'team.median_acceptance_time', o.median_acceptance_seconds,
        'team.redistributions', coalesce(o.redistributions, 0),
        'team.first_contact_sla_rate', case when coalesce(l.sla_assigned, 0) > 0 then coalesce(l.sla_within, 0)::numeric * 100 / l.sla_assigned else 0 end,
        'team.first_contact_sla_leads', coalesce(l.sla_assigned, 0),
        'team.active_leads', case when m.snapshot_day = (select latest_day from clock) then st.active_leads else null end,
        'team.overdue_returns', case when m.snapshot_day = (select latest_day from clock) then st.overdue_returns else null end,
        'team.critical_overdue_returns', case when m.snapshot_day = (select latest_day from clock) then st.critical_overdue_returns else null end,
        'team.leads_without_next_action', case when m.snapshot_day = (select latest_day from clock) then st.leads_without_next_action else null end,
        'team.quotes', coalesce(q.quote_count, 0),
        'team.sales', coalesce(s.sales_count, 0),
        'team.losses', coalesce(l.losses, 0),
        'team.last_activity_at', null
      ), ${now}::timestamptz
    from missing m
    left join offers o using (tenant_id, broker_id, snapshot_day)
    left join lead_events l using (tenant_id, broker_id, snapshot_day)
    left join quote_rollup q using (tenant_id, broker_id, snapshot_day)
    left join sales_rollup s using (tenant_id, broker_id, snapshot_day)
    left join state_rollup st on st.tenant_id = m.tenant_id and st.broker_id = m.broker_id and m.snapshot_day = (select latest_day from clock)
    on conflict (tenant_id, broker_id, snapshot_day) do nothing
  `);
  const count = result as unknown as { rowCount?: number };
  return { inserted: count.rowCount ?? 0 };
}
