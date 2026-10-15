import "server-only";

import { sql } from "drizzle-orm";

import type { TeamMetricsScope } from "@/features/team-management/scope";
import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { getMetricDefinition } from "./metric-catalog";
import { cohortConversionRate, percentage } from "./metrics-math";

export type TeamMetricsWindowKey = "current" | "previous" | "trailing3" | "previous3";
export type CanonicalTeamMetricId =
  | "commercial.leads_received"
  | "commercial.leads_converted"
  | "commercial.conversion_rate"
  | "team.offers_received"
  | "team.offers_accepted"
  | "team.acceptance_rate"
  | "team.median_acceptance_time"
  | "team.redistributions"
  | "team.first_contact_sla_rate"
  | "team.active_leads"
  | "team.overdue_returns"
  | "team.critical_overdue_returns"
  | "team.leads_without_next_action"
  | "team.quotes"
  | "team.sales"
  | "team.losses"
  | "team.last_activity_at";

export type CanonicalTeamMetricValues = Readonly<Record<CanonicalTeamMetricId, number | null>>;

export interface CanonicalTeamMetricRow {
  readonly scopeType: "broker" | "team" | "unit";
  readonly scopeId: string;
  readonly brokerId: string | null;
  readonly brokerName: string | null;
  readonly brokerImage: string | null;
  readonly supervisorId: string | null;
  readonly supervisorName: string | null;
  readonly teamName: string | null;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly windowKey: TeamMetricsWindowKey;
  readonly metrics: CanonicalTeamMetricValues;
}

export interface CanonicalTeamMetricSnapshot {
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly slaFirstContactMinutes: number;
  readonly windowDays: 7 | 30;
  readonly now: Date;
  readonly rows: readonly CanonicalTeamMetricRow[];
}

type RawMetricRow = Record<string, unknown>;

const CATALOG_METRIC_IDS: readonly CanonicalTeamMetricId[] = [
  "commercial.leads_received",
  "commercial.leads_converted",
  "commercial.conversion_rate",
  "team.offers_received",
  "team.offers_accepted",
  "team.acceptance_rate",
  "team.median_acceptance_time",
  "team.redistributions",
  "team.first_contact_sla_rate",
  "team.active_leads",
  "team.overdue_returns",
  "team.critical_overdue_returns",
  "team.leads_without_next_action",
  "team.quotes",
  "team.sales",
  "team.losses",
  "team.last_activity_at",
];

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampValue(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function assertCanonicalCatalog() {
  for (const id of CATALOG_METRIC_IDS) {
    if (!getMetricDefinition(id)) throw new Error(`A métrica canônica ${id} não está registrada no catálogo.`);
  }
}

/**
 * One grouped SQL query resolves both equal windows, their broker/team/unit
 * dimensions, and current portfolio snapshots. Access scope is supplied only
 * by the server-side team-management boundary resolver.
 */
export async function resolveCanonicalTeamMetrics(
  context: TenantContext,
  scope: TeamMetricsScope,
  input: { window: 7 | 30; now: Date },
): Promise<CanonicalTeamMetricSnapshot> {
  assertCanonicalCatalog();
  if (scope.tenantId !== context.tenantId) throw new Error("O escopo de métricas não pertence ao tenant autenticado.");

  const now = input.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("A data de referência das métricas é inválida.");
  const branchId = scope.kind === "unit" ? scope.branchId : null;
  const supervisorId = scope.kind === "team" ? scope.supervisorId : null;
  const managerScope = scope.kind === "unit";
  const supervisorOfferScope = supervisorId
    ? sql`and ${inSupervisorTeam(schema.leadOffers.brokerId, context.tenantId, supervisorId)}`
    : sql``;
  const supervisorLeadScope = supervisorId
    ? sql`and ${inSupervisorTeam(schema.leads.corretorId, context.tenantId, supervisorId)}`
    : sql``;
  const supervisorSalesScope = supervisorId
    ? sql`and ${inSupervisorTeam(schema.sales.brokerId, context.tenantId, supervisorId)}`
    : sql``;

  const result = await getDatabase().execute(sql`
    with
    params as (
      select
        ${context.tenantId}::text as tenant_id,
        ${branchId}::text as branch_id,
        ${supervisorId}::text as supervisor_id,
        ${managerScope}::boolean as is_manager,
        ${now}::timestamptz as now_at,
        ${input.window}::int as window_days,
        case
          when t.sla_first_contact_minutes ~ '^[0-9]+$'
            and t.sla_first_contact_minutes::int > 0 then t.sla_first_contact_minutes::int
          else 15
        end as sla_minutes
      from tenants t
      where t.id = ${context.tenantId}
    ),
    periods as (
      select 'current'::text as window_key, p.now_at - (p.window_days * interval '1 day') as starts_at, p.now_at as ends_at from params p
      union all
      select 'previous', p.now_at - (p.window_days * 2 * interval '1 day'), p.now_at - (p.window_days * interval '1 day') from params p
      union all
      select 'trailing3', p.now_at - interval '3 days', p.now_at from params p
      union all
      select 'previous3', p.now_at - interval '6 days', p.now_at - interval '3 days' from params p
    ),
    roster as (
      select
        tm.user_id as broker_id,
        tm.branch_id,
        tm.supervisor_id,
        u.name as broker_name,
        u.image as broker_image,
        supervisor.name as supervisor_name,
        st.name as team_name,
        b.name as branch_name
      from tenant_memberships tm
      join "user" u on u.id = tm.user_id and u.active = true
      left join "user" supervisor on supervisor.id = tm.supervisor_id
      left join supervisor_teams st on st.tenant_id = tm.tenant_id and st.supervisor_id = tm.supervisor_id
      left join branches b on b.id = tm.branch_id and b.tenant_id = tm.tenant_id
      cross join params p
      where tm.tenant_id = p.tenant_id
        and tm.role = 'broker'
        and tm.status = 'active'
        and ((p.is_manager and tm.branch_id = p.branch_id) or (not p.is_manager and tm.supervisor_id = p.supervisor_id))
    ),
    event_facts as (
      select
        r.broker_id,
        r.supervisor_id,
        w.window_key,
        1::int as offers_received,
        case when o.accepted_at is not null then 1 else 0 end::int as offers_accepted,
        case when o.accepted_at is not null and o.accepted_at >= o.offered_at
          then extract(epoch from (o.accepted_at - o.offered_at))::double precision else null end as accepted_seconds,
        case when o.status in ('EXPIRED', 'DECLINED', 'REPLACED') then 1 else 0 end::int as redistributions,
        0::int as sla_assigned,
        0::int as sla_within,
        0::int as cohort_received,
        0::int as converted,
        0::int as losses,
        0::int as quotes,
        0::int as sales
      from lead_offers o
      join roster r on r.broker_id = o.broker_id
      cross join params p
      join periods w on o.offered_at >= w.starts_at and o.offered_at < w.ends_at
      where o.tenant_id = p.tenant_id
        and o.status not in ('CANCELLED', 'LOST')
        ${supervisorOfferScope}

      union all

      select
        r.broker_id, r.supervisor_id, w.window_key,
        0, 0, null, 0, 0, 0,
        1,
        case when leads.status = 'converted' then 1 else 0 end,
        case when leads.status = 'lost' then 1 else 0 end,
        0, 0
      from leads
      join roster r on r.broker_id = leads.corretor_id
      cross join params p
      join periods w on leads.created_at >= w.starts_at and leads.created_at < w.ends_at
      where leads.tenant_id = p.tenant_id
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorLeadScope}

      union all

      select
        r.broker_id, r.supervisor_id, w.window_key,
        0, 0, null, 0,
        1,
        case when leads.first_contact_at is not null
          and leads.first_contact_at <= leads.assigned_at + (p.sla_minutes * interval '1 minute') then 1 else 0 end,
        0, 0, 0, 0, 0
      from leads
      join roster r on r.broker_id = leads.corretor_id
      cross join params p
      join periods w on leads.assigned_at >= w.starts_at and leads.assigned_at < w.ends_at
      where leads.tenant_id = p.tenant_id
        and leads.assigned_at is not null
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorLeadScope}

      union all

      select
        r.broker_id, r.supervisor_id, w.window_key,
        0, 0, null, 0, 0, 0, 0, 0, 0, 1, 0
      from quotes
      join leads on leads.id = quotes.lead_id and leads.tenant_id = quotes.tenant_id
      join roster r on r.broker_id = leads.corretor_id
      cross join params p
      join periods w on quotes.created_at >= w.starts_at and quotes.created_at < w.ends_at
      where quotes.tenant_id = p.tenant_id
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorLeadScope}

      union all

      select
        r.broker_id, r.supervisor_id, w.window_key,
        0, 0, null, 0, 0, 0, 0, 0, 0, 0, 1
      from sales
      join leads on leads.id = sales.lead_id and leads.tenant_id = sales.tenant_id
      join roster r on r.broker_id = sales.broker_id
      cross join params p
      join periods w on sales.sale_date >= w.starts_at and sales.sale_date < w.ends_at
      where sales.tenant_id = p.tenant_id
        and sales.status = 'active'
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorSalesScope}
    ),
    event_rollup as (
      select
        case when grouping(f.broker_id) = 0 then 'broker' when grouping(f.supervisor_id) = 0 then 'team' else 'unit' end as scope_type,
        case when grouping(f.broker_id) = 0 then f.broker_id
             when grouping(f.supervisor_id) = 0 then coalesce(f.supervisor_id, '__no_team__')
             else (select branch_id from params) end as scope_id,
        f.window_key,
        sum(f.offers_received)::int as offers_received,
        sum(f.offers_accepted)::int as offers_accepted,
        percentile_cont(0.5) within group (order by f.accepted_seconds) filter (where f.accepted_seconds is not null) as median_acceptance_seconds,
        sum(f.redistributions)::int as redistributions,
        sum(f.sla_assigned)::int as sla_assigned,
        sum(f.sla_within)::int as sla_within,
        sum(f.cohort_received)::int as cohort_received,
        sum(f.converted)::int as converted,
        sum(f.losses)::int as losses,
        sum(f.quotes)::int as quotes,
        sum(f.sales)::int as sales
      from event_facts f
      group by f.window_key, grouping sets ((f.broker_id, f.supervisor_id), (f.supervisor_id), ())
      having (select is_manager from params) or grouping(f.supervisor_id) = 0
    ),
    unit_facts as (
      select
        w.window_key,
        1::int as offers_received,
        case when lead_offers.accepted_at is not null then 1 else 0 end::int as offers_accepted,
        case when lead_offers.accepted_at is not null and lead_offers.accepted_at >= lead_offers.offered_at
          then extract(epoch from (lead_offers.accepted_at - lead_offers.offered_at))::double precision else null end as accepted_seconds,
        case when lead_offers.status in ('EXPIRED', 'DECLINED', 'REPLACED') then 1 else 0 end::int as redistributions,
        0::int as sla_assigned, 0::int as sla_within, 0::int as cohort_received, 0::int as converted, 0::int as losses, 0::int as quotes, 0::int as sales
      from lead_offers
      join leads on leads.id = lead_offers.lead_id and leads.tenant_id = lead_offers.tenant_id
      cross join params p
      join periods w on lead_offers.offered_at >= w.starts_at and lead_offers.offered_at < w.ends_at
      where p.is_manager and lead_offers.tenant_id = p.tenant_id and leads.branch_id = p.branch_id
        and lead_offers.status not in ('CANCELLED', 'LOST') and leads.deleted_at is null and leads.archived_at is null

      union all
      select w.window_key, 0, 0, null, 0, 0, 0, 1,
        case when leads.status = 'converted' then 1 else 0 end,
        case when leads.status = 'lost' then 1 else 0 end, 0, 0
      from leads cross join params p join periods w on leads.created_at >= w.starts_at and leads.created_at < w.ends_at
      where p.is_manager and leads.tenant_id = p.tenant_id and leads.branch_id = p.branch_id
        and leads.deleted_at is null and leads.archived_at is null

      union all
      select w.window_key, 0, 0, null, 0, 1,
        case when leads.first_contact_at is not null
          and leads.first_contact_at <= leads.assigned_at + (p.sla_minutes * interval '1 minute') then 1 else 0 end,
        0, 0, 0, 0, 0
      from leads cross join params p join periods w on leads.assigned_at >= w.starts_at and leads.assigned_at < w.ends_at
      where p.is_manager and leads.tenant_id = p.tenant_id and leads.branch_id = p.branch_id
        and leads.assigned_at is not null and leads.deleted_at is null and leads.archived_at is null

      union all
      select w.window_key, 0, 0, null, 0, 0, 0, 0, 0, 0, 1, 0
      from quotes join leads on leads.id = quotes.lead_id and leads.tenant_id = quotes.tenant_id
      cross join params p join periods w on quotes.created_at >= w.starts_at and quotes.created_at < w.ends_at
      where p.is_manager and quotes.tenant_id = p.tenant_id and leads.branch_id = p.branch_id
        and leads.deleted_at is null and leads.archived_at is null

      union all
      select w.window_key, 0, 0, null, 0, 0, 0, 0, 0, 0, 0, 1
      from sales join leads on leads.id = sales.lead_id and leads.tenant_id = sales.tenant_id
      cross join params p join periods w on sales.sale_date >= w.starts_at and sales.sale_date < w.ends_at
      where p.is_manager and sales.tenant_id = p.tenant_id and sales.status = 'active'
        and leads.branch_id = p.branch_id and leads.deleted_at is null and leads.archived_at is null
    ),
    unit_rollup as (
      select
        w.window_key,
        sum(f.offers_received)::int as offers_received,
        sum(f.offers_accepted)::int as offers_accepted,
        percentile_cont(0.5) within group (order by f.accepted_seconds) filter (where f.accepted_seconds is not null) as median_acceptance_seconds,
        sum(f.redistributions)::int as redistributions,
        sum(f.sla_assigned)::int as sla_assigned,
        sum(f.sla_within)::int as sla_within,
        sum(f.cohort_received)::int as cohort_received,
        sum(f.converted)::int as converted,
        sum(f.losses)::int as losses,
        sum(f.quotes)::int as quotes,
        sum(f.sales)::int as sales
      from unit_facts f
      group by f.window_key
    ),
    task_summary as (
      select
        lead_tasks.lead_id,
        count(*) filter (where lead_tasks.due_at is not null and lead_tasks.due_at < p.now_at)::int as overdue_returns,
        count(*) filter (where lead_tasks.priority = 'urgent' and lead_tasks.due_at is not null and lead_tasks.due_at < p.now_at)::int as critical_overdue_returns
      from lead_tasks
      join leads on leads.id = lead_tasks.lead_id and leads.tenant_id = lead_tasks.tenant_id
      join roster r on r.broker_id = leads.corretor_id
      cross join params p
      where lead_tasks.tenant_id = p.tenant_id
        and lead_tasks.completed_at is null
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorLeadScope}
      group by lead_tasks.lead_id
    ),
    state_facts as (
      select
        r.broker_id,
        r.supervisor_id,
        1::int as active_leads,
        coalesce(ts.overdue_returns, 0)::int as overdue_returns,
        coalesce(ts.critical_overdue_returns, 0)::int as critical_overdue_returns,
        case when leads.status in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
          and ts.lead_id is null then 1 else 0 end::int as leads_without_next_action
      from leads
      join roster r on r.broker_id = leads.corretor_id
      left join task_summary ts on ts.lead_id = leads.id
      cross join params p
      where leads.tenant_id = p.tenant_id
        and leads.status in ('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
        and leads.deleted_at is null
        and leads.archived_at is null
        ${supervisorLeadScope}
    ),
    state_rollup as (
      select
        case when grouping(f.broker_id) = 0 then 'broker' when grouping(f.supervisor_id) = 0 then 'team' else 'unit' end as scope_type,
        case when grouping(f.broker_id) = 0 then f.broker_id
             when grouping(f.supervisor_id) = 0 then coalesce(f.supervisor_id, '__no_team__')
             else (select branch_id from params) end as scope_id,
        sum(f.active_leads)::int as active_leads,
        sum(f.overdue_returns)::int as overdue_returns,
        sum(f.critical_overdue_returns)::int as critical_overdue_returns,
        sum(f.leads_without_next_action)::int as leads_without_next_action
      from state_facts f
      group by grouping sets ((f.broker_id, f.supervisor_id), (f.supervisor_id), ())
      having (select is_manager from params) or grouping(f.supervisor_id) = 0
    ),
    activity_facts as (
      select roster.broker_id, roster.supervisor_id, leads.updated_at as activity_at
      from leads join roster on roster.broker_id = leads.corretor_id cross join params p
      where leads.tenant_id = p.tenant_id and leads.deleted_at is null and leads.archived_at is null ${supervisorLeadScope}
      union all
      select roster.broker_id, roster.supervisor_id, lead_offers.updated_at
      from lead_offers join roster on roster.broker_id = lead_offers.broker_id
      join leads on leads.id = lead_offers.lead_id and leads.tenant_id = lead_offers.tenant_id
      cross join params p
      where lead_offers.tenant_id = p.tenant_id and leads.deleted_at is null and leads.archived_at is null ${supervisorOfferScope}
      union all
      select roster.broker_id, roster.supervisor_id, lead_tasks.updated_at
      from lead_tasks join leads on leads.id = lead_tasks.lead_id and leads.tenant_id = lead_tasks.tenant_id
      join roster on roster.broker_id = leads.corretor_id cross join params p
      where lead_tasks.tenant_id = p.tenant_id and leads.deleted_at is null and leads.archived_at is null ${supervisorLeadScope}
      union all
      select roster.broker_id, roster.supervisor_id, quotes.updated_at
      from quotes join leads on leads.id = quotes.lead_id and leads.tenant_id = quotes.tenant_id
      join roster on roster.broker_id = leads.corretor_id cross join params p
      where quotes.tenant_id = p.tenant_id and leads.deleted_at is null and leads.archived_at is null ${supervisorLeadScope}
      union all
      select roster.broker_id, roster.supervisor_id, sales.sale_date
      from sales join leads on leads.id = sales.lead_id and leads.tenant_id = sales.tenant_id
      join roster on roster.broker_id = sales.broker_id cross join params p
      where sales.tenant_id = p.tenant_id and sales.status = 'active' and leads.deleted_at is null and leads.archived_at is null ${supervisorSalesScope}
    ),
    activity_rollup as (
      select
        case when grouping(f.broker_id) = 0 then 'broker' when grouping(f.supervisor_id) = 0 then 'team' else 'unit' end as scope_type,
        case when grouping(f.broker_id) = 0 then f.broker_id
             when grouping(f.supervisor_id) = 0 then coalesce(f.supervisor_id, '__no_team__')
             else (select branch_id from params) end as scope_id,
        max(f.activity_at) as last_activity_at
      from activity_facts f
      group by grouping sets ((f.broker_id, f.supervisor_id), (f.supervisor_id), ())
      having (select is_manager from params) or grouping(f.supervisor_id) = 0
    ),
    scope_entities as (
      select 'broker'::text as scope_type, r.broker_id as scope_id, r.broker_id, r.broker_name,
        r.broker_image, r.supervisor_id, r.supervisor_name,
        coalesce(r.team_name, case when r.supervisor_id is null then 'Sem equipe' else 'Equipe' end) as team_name,
        r.branch_id, r.branch_name
      from roster r
      union all
      select 'team', coalesce(r.supervisor_id, '__no_team__'), null::text, null::text, null::text,
        r.supervisor_id, min(r.supervisor_name),
        case when r.supervisor_id is null then 'Sem equipe' else coalesce(min(r.team_name), 'Equipe') end,
        min(r.branch_id), min(r.branch_name)
      from roster r
      group by r.supervisor_id
      union all
      select 'unit', p.branch_id, null::text, null::text, null::text, null::text, null::text, null::text,
        p.branch_id, b.name
      from params p left join branches b on b.id = p.branch_id and b.tenant_id = p.tenant_id
      where p.is_manager
    )
    select
      e.scope_type,
      e.scope_id,
      e.broker_id,
      e.broker_name,
      e.broker_image,
      e.supervisor_id,
      e.supervisor_name,
      e.team_name,
      e.branch_id,
      e.branch_name,
      w.window_key,
      coalesce(case when e.scope_type = 'unit' then ur.offers_received else er.offers_received end, 0)::int as offers_received,
      coalesce(case when e.scope_type = 'unit' then ur.offers_accepted else er.offers_accepted end, 0)::int as offers_accepted,
      case when e.scope_type = 'unit' then ur.median_acceptance_seconds else er.median_acceptance_seconds end as median_acceptance_seconds,
      coalesce(case when e.scope_type = 'unit' then ur.redistributions else er.redistributions end, 0)::int as redistributions,
      coalesce(case when e.scope_type = 'unit' then ur.sla_assigned else er.sla_assigned end, 0)::int as sla_assigned,
      coalesce(case when e.scope_type = 'unit' then ur.sla_within else er.sla_within end, 0)::int as sla_within,
      coalesce(case when e.scope_type = 'unit' then ur.cohort_received else er.cohort_received end, 0)::int as cohort_received,
      coalesce(case when e.scope_type = 'unit' then ur.converted else er.converted end, 0)::int as converted,
      coalesce(case when e.scope_type = 'unit' then ur.losses else er.losses end, 0)::int as losses,
      coalesce(case when e.scope_type = 'unit' then ur.quotes else er.quotes end, 0)::int as quotes,
      coalesce(case when e.scope_type = 'unit' then ur.sales else er.sales end, 0)::int as sales,
      case when w.window_key = 'current' then coalesce(sr.active_leads, 0)::int else null end as active_leads,
      case when w.window_key = 'current' then coalesce(sr.overdue_returns, 0)::int else null end as overdue_returns,
      case when w.window_key = 'current' then coalesce(sr.critical_overdue_returns, 0)::int else null end as critical_overdue_returns,
      case when w.window_key = 'current' then coalesce(sr.leads_without_next_action, 0)::int else null end as leads_without_next_action,
      case when w.window_key = 'current' then ar.last_activity_at else null end as last_activity_at,
      p.sla_minutes
    from scope_entities e
    cross join periods w
    cross join params p
    left join event_rollup er on er.scope_type = e.scope_type and er.scope_id = e.scope_id and er.window_key = w.window_key
    left join unit_rollup ur on e.scope_type = 'unit' and ur.window_key = w.window_key
    left join state_rollup sr on sr.scope_type = e.scope_type and sr.scope_id = e.scope_id
    left join activity_rollup ar on ar.scope_type = e.scope_type and ar.scope_id = e.scope_id
    order by e.scope_type, e.scope_id, w.window_key
  `);

  const rawRows = result as unknown as RawMetricRow[];
  const rows: CanonicalTeamMetricRow[] = rawRows.map((row) => {
    const windowKey = String(row.window_key) as TeamMetricsWindowKey;
    const received = numberValue(row.offers_received);
    const accepted = numberValue(row.offers_accepted);
    const slaAssigned = numberValue(row.sla_assigned);
    const slaWithin = numberValue(row.sla_within);
    const cohortReceived = numberValue(row.cohort_received);
    const converted = numberValue(row.converted);
    const snapshot = windowKey === "current";
    const metricValues = {
      "commercial.leads_received": cohortReceived,
      "commercial.leads_converted": converted,
      "commercial.conversion_rate": cohortConversionRate(converted, cohortReceived),
      "team.offers_received": received,
      "team.offers_accepted": accepted,
      "team.acceptance_rate": percentage(accepted, received),
      "team.median_acceptance_time": row.median_acceptance_seconds == null ? null : numberValue(row.median_acceptance_seconds),
      "team.redistributions": numberValue(row.redistributions),
      "team.first_contact_sla_rate": percentage(slaWithin, slaAssigned),
      "team.active_leads": snapshot ? numberValue(row.active_leads) : null,
      "team.overdue_returns": snapshot ? numberValue(row.overdue_returns) : null,
      "team.critical_overdue_returns": snapshot ? numberValue(row.critical_overdue_returns) : null,
      "team.leads_without_next_action": snapshot ? numberValue(row.leads_without_next_action) : null,
      "team.quotes": numberValue(row.quotes),
      "team.sales": numberValue(row.sales),
      "team.losses": numberValue(row.losses),
      "team.last_activity_at": snapshot ? timestampValue(row.last_activity_at) : null,
    } satisfies Record<CanonicalTeamMetricId, number | null>;

    return {
      scopeType: String(row.scope_type) as CanonicalTeamMetricRow["scopeType"],
      scopeId: String(row.scope_id),
      brokerId: row.broker_id == null ? null : String(row.broker_id),
      brokerName: row.broker_name == null ? null : String(row.broker_name),
      brokerImage: row.broker_image == null ? null : String(row.broker_image),
      supervisorId: row.supervisor_id == null ? null : String(row.supervisor_id),
      supervisorName: row.supervisor_name == null ? null : String(row.supervisor_name),
      teamName: row.team_name == null ? null : String(row.team_name),
      branchId: row.branch_id == null ? null : String(row.branch_id),
      branchName: row.branch_name == null ? null : String(row.branch_name),
      windowKey,
      metrics: metricValues,
    };
  });

  const branchName = rows.find((row) => row.scopeType === "unit")?.branchName ?? rows.find((row) => row.branchName)?.branchName ?? null;
  return {
    tenantId: context.tenantId,
    branchId,
    branchName,
    slaFirstContactMinutes: numberValue(rawRows[0]?.sla_minutes) || 15,
    windowDays: input.window,
    now,
    rows,
  };
}
