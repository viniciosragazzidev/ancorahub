-- Conferência manual do G0 contra getSupervisorLiteMemberPulse.
-- Antes de executar no Supabase SQL Editor, substitua os seis valores abaixo.
-- A consulta é somente leitura; não altera dados nem depende de migration.
with
input as (
  select
    '<TENANT_ID>'::text as tenant_id,
    '<UNIDADE_ID>'::text as branch_id,
    '<SUPERVISOR_ID>'::text as supervisor_id,
    now() as now_at,
    (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as today_start
),
brokers as (
  select * from (values
    ('<CORRETOR_1_ID>'::text, 'Corretor 1'::text),
    ('<CORRETOR_2_ID>'::text, 'Corretor 2'::text),
    ('<CORRETOR_3_ID>'::text, 'Corretor 3'::text)
  ) as selected(user_id, label)
),
authorized_brokers as (
  select selected.user_id, selected.label
  from brokers selected
  join tenant_memberships membership
    on membership.user_id = selected.user_id
  cross join input i
  where membership.tenant_id = i.tenant_id
    and membership.branch_id = i.branch_id
    and membership.supervisor_id = i.supervisor_id
    and membership.role = 'broker'
    and membership.status = 'active'
),
tenant_sla as (
  select case
    when sla_first_contact_minutes ~ '^[0-9]+$' and sla_first_contact_minutes::int > 0
      then sla_first_contact_minutes::int
    else 15
  end as sla_minutes
  from tenants t cross join input i
  where t.id = i.tenant_id
),
offer_pulse as (
  select
    a.user_id,
    count(*) filter (
      where offers.offered_at >= i.now_at - interval '7 days'
        and offers.offered_at < i.now_at
        and offers.status not in ('CANCELLED', 'LOST')
    )::int as received_7d,
    count(*) filter (
      where offers.offered_at >= i.now_at - interval '7 days'
        and offers.offered_at < i.now_at
        and offers.status not in ('CANCELLED', 'LOST')
        and offers.accepted_at is not null
    )::int as accepted_7d,
    percentile_cont(0.5) within group (
      order by extract(epoch from (offers.accepted_at - offers.offered_at))
    ) filter (
      where offers.offered_at >= i.now_at - interval '7 days'
        and offers.offered_at < i.now_at
        and offers.status not in ('CANCELLED', 'LOST')
        and offers.accepted_at is not null
        and offers.accepted_at >= offers.offered_at
    ) as median_accept_seconds_7d,
    count(*) filter (
      where offers.offered_at >= i.now_at - interval '3 days'
        and offers.offered_at < i.now_at
        and offers.status in ('EXPIRED', 'DECLINED', 'REPLACED')
    )::int as redistributions_3d
  from authorized_brokers a
  cross join input i
  left join lead_offers offers on offers.tenant_id = i.tenant_id and offers.broker_id = a.user_id
  group by a.user_id
),
pulse_today as (
  select
    a.user_id,
    count(distinct leads.id) filter (
      where leads.assigned_at >= i.today_start
        and leads.assigned_at < i.today_start + interval '1 day'
    )::int as received_today,
    count(distinct leads.id) filter (
      where leads.assigned_at >= i.today_start
        and leads.assigned_at < i.today_start + interval '1 day'
        and exists (
          select 1 from lead_offers accepted
          where accepted.tenant_id = i.tenant_id
            and accepted.lead_id = leads.id
            and accepted.broker_id = a.user_id
            and accepted.status = 'ACCEPTED'
            and accepted.accepted_at >= i.today_start
            and accepted.accepted_at < i.today_start + interval '1 day'
        )
    )::int as accepted_today,
    count(distinct leads.id) filter (
      where leads.status in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
    )::int as in_service_now,
    count(distinct leads.id) filter (
      where leads.first_contact_at is null
        and leads.assigned_at < i.now_at - (sla.sla_minutes * interval '1 minute')
    )::int as late_now
  from authorized_brokers a
  cross join input i
  cross join tenant_sla sla
  left join leads on leads.tenant_id = i.tenant_id
    and leads.branch_id = i.branch_id
    and leads.corretor_id = a.user_id
    and leads.deleted_at is null
    and leads.archived_at is null
  group by a.user_id, i.today_start, i.now_at, sla.sla_minutes
),
pulse_contact_sla as (
  select
    a.user_id,
    count(*) filter (
      where leads.first_contact_at >= i.today_start - interval '6 days'
        and leads.first_contact_at < i.today_start + interval '1 day'
    )::int as pulse_contact_total_7d,
    count(*) filter (
      where leads.first_contact_at >= i.today_start - interval '6 days'
        and leads.first_contact_at < i.today_start + interval '1 day'
        and leads.assigned_at is not null
        and leads.first_contact_at <= leads.assigned_at + (sla.sla_minutes * interval '1 minute')
    )::int as pulse_contact_on_time_7d
  from authorized_brokers a
  cross join input i
  cross join tenant_sla sla
  left join leads on leads.tenant_id = i.tenant_id
    and leads.branch_id = i.branch_id
    and leads.corretor_id = a.user_id
    and leads.deleted_at is null
    and leads.archived_at is null
  group by a.user_id, i.today_start, sla.sla_minutes
),
g0_window as (
  select
    a.user_id,
    count(*) filter (where leads.created_at >= i.now_at - interval '7 days' and leads.created_at < i.now_at)::int as leads_received_7d,
    count(*) filter (where leads.created_at >= i.now_at - interval '7 days' and leads.created_at < i.now_at and leads.status = 'converted')::int as leads_converted_7d,
    count(*) filter (where leads.assigned_at >= i.now_at - interval '7 days' and leads.assigned_at < i.now_at)::int as assigned_7d,
    count(*) filter (
      where leads.assigned_at >= i.now_at - interval '7 days' and leads.assigned_at < i.now_at
        and leads.first_contact_at is not null
        and leads.first_contact_at <= leads.assigned_at + (sla.sla_minutes * interval '1 minute')
    )::int as assigned_contacted_in_sla_7d,
    count(*) filter (where leads.created_at >= i.now_at - interval '7 days' and leads.created_at < i.now_at and leads.status = 'lost')::int as losses_7d
  from authorized_brokers a
  cross join input i
  cross join tenant_sla sla
  left join leads on leads.tenant_id = i.tenant_id
    and leads.branch_id = i.branch_id
    and leads.corretor_id = a.user_id
    and leads.deleted_at is null
    and leads.archived_at is null
  group by a.user_id, i.now_at, sla.sla_minutes
),
current_portfolio as (
  select
    a.user_id,
    count(distinct leads.id) filter (
      where leads.status in ('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
    )::int as active_leads,
    count(distinct tasks.id) filter (
      where tasks.completed_at is null and tasks.due_at is not null and tasks.due_at < i.now_at
    )::int as overdue_returns,
    count(distinct leads.id) filter (
      where leads.status in ('in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis')
        and not exists (
          select 1 from lead_tasks open_task
          where open_task.tenant_id = i.tenant_id
            and open_task.lead_id = leads.id
            and open_task.completed_at is null
        )
    )::int as without_next_action
  from authorized_brokers a
  cross join input i
  left join leads on leads.tenant_id = i.tenant_id
    and leads.branch_id = i.branch_id
    and leads.corretor_id = a.user_id
    and leads.deleted_at is null
    and leads.archived_at is null
  left join lead_tasks tasks on tasks.tenant_id = i.tenant_id and tasks.lead_id = leads.id
  group by a.user_id, i.now_at
)
select
  a.label,
  a.user_id,
  pulse.received_today,
  pulse.accepted_today,
  pulse.in_service_now,
  pulse.late_now,
  offers.received_7d,
  offers.accepted_7d,
  round(100.0 * offers.accepted_7d / nullif(offers.received_7d, 0), 1) as acceptance_rate_7d_pct,
  round(offers.median_accept_seconds_7d::numeric, 1) as median_accept_seconds_7d,
  offers.redistributions_3d,
  g0.assigned_7d,
  g0.assigned_contacted_in_sla_7d,
  round(100.0 * g0.assigned_contacted_in_sla_7d / nullif(g0.assigned_7d, 0), 1) as g0_assignment_sla_pct,
  pulse_sla.pulse_contact_total_7d,
  pulse_sla.pulse_contact_on_time_7d,
  round(100.0 * pulse_sla.pulse_contact_on_time_7d / nullif(pulse_sla.pulse_contact_total_7d, 0), 1) as pulse_contact_sla_pct,
  g0.leads_received_7d,
  g0.leads_converted_7d,
  round(100.0 * g0.leads_converted_7d / nullif(g0.leads_received_7d, 0), 1) as canonical_conversion_pct,
  g0.losses_7d,
  portfolio.active_leads,
  portfolio.overdue_returns,
  portfolio.without_next_action
from authorized_brokers a
left join pulse_today pulse using (user_id)
left join offer_pulse offers using (user_id)
left join pulse_contact_sla pulse_sla using (user_id)
left join g0_window g0 using (user_id)
left join current_portfolio portfolio using (user_id)
order by a.label;
