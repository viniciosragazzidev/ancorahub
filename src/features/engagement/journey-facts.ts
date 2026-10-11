import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { isValidOn } from "@/features/lead-distribution/monthly-duty-plan";
import { selectEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import type { AchievementEvidence, JourneyDayFacts } from "./journey-types";
import type { MissionSubject } from "./missions";
import { journeyDay, journeyWeek, shiftJourneyDay } from "./journey-periods";
import { confirmedPresenceSequence } from "./achievements";

export type BrokerJourneyFacts = { subject: MissionSubject; days: JourneyDayFacts[]; evidence: AchievementEvidence; totalPoints: number; pointsByDay?: Record<string, number> };
type CountRow = { broker: string; day: string; received?: number; breaches?: number; evidenced?: number; service?: number; notes?: number; offers?: number; due?: number; overdue?: number; returned?: number; contacts?: number; ontime?: number; fast?: number; accepted?: number; points?: number };
export const emptyJourneyDay = (date: string): JourneyDayFacts => ({ date, hasDuty: false, receivedLeads: 0, evidencedContacts: 0, fastContacts: 0, onTimeContacts: 0, offers: 0, fastAcceptedOffers: 0, serviceLeads: 0, validNotes: 0, returnsDue: 0, returnsCompletedOnTime: 0, overdueReturns: 0, slaBreaches: 0, confirmedPresence: false });

/** Batch sources. Notes bypass the points cap; SLA uses actual sent human messages. */
export async function readJourneyFacts(tenantId: string, brokerIds: string[], now: Date, slaMinutes: number, salesEnabled = false): Promise<BrokerJourneyFacts[]> {
  if (!brokerIds.length) return [];
  const db = getDatabase();
  const ids = sql.join(brokerIds.map((id) => sql`${id}`), sql`, `);
  const nowIso = now.toISOString();
  const today = journeyDay(now);
  const [members, ledger, assignments, services, notes, offers, tasks, roster, presences, monthly, sales, stages] = await Promise.all([
    db.select({ brokerId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.userId, brokerIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"))),
    db.execute<CountRow>(sql`select broker_id as broker, period_day::text as day, sum(points)::int as points,
      count(*) filter (where rule_key='contact.first')::int as contacts,
      count(*) filter (where rule_key='contact.first' and (metadata->>'latencySeconds')::numeric<=${slaMinutes * 60})::int as ontime,
      count(*) filter (where rule_key='contact.first' and metadata->>'tier'='5min')::int as fast,
      count(*) filter (where rule_key='offer.fast_accept')::int as accepted,
      count(*) filter (where rule_key='return.on_time')::int as returned
      from engagement_point_events where tenant_id=${tenantId} and broker_id in (${ids}) and reversed_at is null
      group by broker_id, period_day`),
    db.execute<CountRow>(sql`select l.corretor_id as broker, (l.assigned_at at time zone 'America/Sao_Paulo')::date::text as day,
      count(*) filter (where first_contact.sent_at is not null and first_contact.sent_at<=l.assigned_at+interval '5 minutes')::int as fast,
      count(*) filter (where first_contact.sent_at is not null)::int as evidenced,
      count(*) filter (where first_contact.sent_at is not null and first_contact.sent_at<=l.assigned_at+(${slaMinutes} * interval '1 minute'))::int as ontime,
      count(*)::int as received, count(*) filter (where
        coalesce(first_contact.sent_at, ${nowIso}::timestamptz) > l.assigned_at + (${slaMinutes} * interval '1 minute'))::int as breaches
      from leads l left join lateral (select min(w.sent_at) as sent_at from whatsapp_messages w
        where w.tenant_id=${tenantId} and w.lead_id=l.id and w.sent_at>=l.assigned_at
        and w.direction in ('outgoing','outbound') and (w.sender_role is null or w.sender_role in ('user','agent'))) first_contact on true
      where l.tenant_id=${tenantId} and l.corretor_id in (${ids}) and l.deleted_at is null and l.assigned_at is not null
      group by l.corretor_id, (l.assigned_at at time zone 'America/Sao_Paulo')::date`),
    db.execute<CountRow>(sql`select corretor_id as broker, (service_started_at at time zone 'America/Sao_Paulo')::date::text as day, count(*)::int as service
      from leads where tenant_id=${tenantId} and corretor_id in (${ids}) and deleted_at is null and service_started_at is not null
      group by corretor_id, (service_started_at at time zone 'America/Sao_Paulo')::date`),
    db.execute<CountRow>(sql`with normalized as (select i.user_id as broker, i.lead_id, i.created_at, l.service_started_at,
      (i.created_at at time zone 'America/Sao_Paulo')::date as day,
      trim(regexp_replace(regexp_replace(normalize(lower(i.conteudo), NFD), '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', ' ', 'g')) as body,
      row_number() over (partition by i.user_id, (i.created_at at time zone 'America/Sao_Paulo')::date,
        trim(regexp_replace(regexp_replace(normalize(lower(i.conteudo), NFD), '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', ' ', 'g')) order by i.created_at,i.id) as rn
      from lead_interactions i join leads l on l.id=i.lead_id and l.tenant_id=${tenantId} and l.corretor_id=i.user_id
      where i.tipo='note' and i.user_id in (${ids}) and l.deleted_at is null)
      select broker,day::text,count(distinct lead_id)::int as notes from normalized where length(body)>=40 and rn=1
        and created_at>=service_started_at and day=(service_started_at at time zone 'America/Sao_Paulo')::date group by broker,day`),
    db.execute<CountRow>(sql`select o.broker_id as broker, (o.offered_at at time zone 'America/Sao_Paulo')::date::text as day, count(*)::int as offers,
      count(*) filter (where exists (select 1 from engagement_point_events e where e.tenant_id=${tenantId} and e.broker_id=o.broker_id and e.entity_id=o.id and e.rule_key='offer.fast_accept' and e.reversed_at is null))::int as accepted
      from lead_offers o where o.tenant_id=${tenantId} and o.broker_id in (${ids}) and o.status<>'CANCELLED'
      group by o.broker_id, (o.offered_at at time zone 'America/Sao_Paulo')::date`),
    db.execute<CountRow>(sql`with days as (select ${shiftJourneyDay(today, -1)}::date as day union all select ${today}::date)
      select t.assigned_to as broker, d.day::text, count(*)::int as due,
        count(*) filter (where t.due_at<least(${nowIso}::timestamptz, ((d.day+1)::timestamp at time zone 'America/Sao_Paulo'))
          and (t.completed_at is null or t.completed_at>=least(${nowIso}::timestamptz, ((d.day+1)::timestamp at time zone 'America/Sao_Paulo'))))::int as overdue
      from days d join lead_tasks t on t.tenant_id=${tenantId} and t.assigned_to in (${ids})
        and t.due_at<((d.day+1)::timestamp at time zone 'America/Sao_Paulo')
        and (t.completed_at is null or t.completed_at>=(d.day::timestamp at time zone 'America/Sao_Paulo'))
      where (t.created_by<>t.assigned_to or t.due_at>=t.created_at+interval '2 hours') group by t.assigned_to,d.day`),
    db.select({ brokerId: schema.dutyRosterAssignments.brokerId, scheduleId: schema.dutyRosterAssignments.scheduleId,
      dutyDate: schema.dutyRosterAssignments.dutyDate, monthlyPlanId: schema.dutyRosterAssignments.monthlyPlanId,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek, startsAt: schema.dutyRosterAssignments.startsAt, timezone: schema.unitDutySchedules.timezone, validFrom: schema.dutyRosterAssignments.validFrom, validUntil: schema.dutyRosterAssignments.validUntil,
      scheduleFrom: schema.unitDutySchedules.validFrom, scheduleUntil: schema.unitDutySchedules.validUntil })
      .from(schema.dutyRosterAssignments).innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, tenantId)))
      .where(and(eq(schema.dutyRosterAssignments.tenantId, tenantId), inArray(schema.dutyRosterAssignments.brokerId, brokerIds), eq(schema.dutyRosterAssignments.status, "active"), eq(schema.unitDutySchedules.status, "active"))),
    db.select({ brokerId: schema.dutyPresenceConfirmations.brokerId, date: schema.dutyPresenceConfirmations.dutyDate, status: schema.dutyPresenceConfirmations.status, confirmedBy: schema.dutyPresenceConfirmations.confirmedBy }).from(schema.dutyPresenceConfirmations)
      .where(and(eq(schema.dutyPresenceConfirmations.tenantId, tenantId), inArray(schema.dutyPresenceConfirmations.brokerId, brokerIds))),
    getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING).catch(() => "false"),
    salesEnabled ? db.execute<{ broker: string; total: number; family: number; business: number }>(sql`
      select s.broker_id as broker, count(*)::int as total,
        count(*) filter (where p.type='familiar')::int as family,
        count(*) filter (where p.type in ('pme','empresarial'))::int as business
      from sales s left join carrier_plans p on p.id=s.carrier_plan_id and p.tenant_id=${tenantId}
      where s.tenant_id=${tenantId} and s.broker_id in (${ids}) and s.status='active' group by s.broker_id`) : [],
    db.execute<{ broker: string; day: string; eligible: number; staged: number }>(sql`
      select corretor_id as broker, (assigned_at at time zone 'America/Sao_Paulo')::date::text as day,
        count(*)::int as eligible, count(*) filter (where status not in ('new','distributed'))::int as staged
      from leads where tenant_id=${tenantId} and corretor_id in (${ids}) and distribution_status='assigned'
        and deleted_at is null and archived_at is null and assigned_at<=${nowIso}::timestamptz-interval '30 minutes'
      group by corretor_id, (assigned_at at time zone 'America/Sao_Paulo')::date`),
  ]);
  return members.map((member) => {
    const days = new Map<string, JourneyDayFacts>();
    const day = (date: string) => { if (!days.has(date)) days.set(date, emptyJourneyDay(date)); return days.get(date)!; };
    let totalPoints = 0;
    const pointsByDay: Record<string, number> = {};
    for (const row of ledger.filter((r) => r.broker === member.brokerId)) {
      const d = day(row.day); d.evidencedContacts = Number(row.contacts); d.onTimeContacts = Number(row.ontime);
      d.returnsCompletedOnTime = Number(row.returned); totalPoints += Number(row.points);
      pointsByDay[row.day] = Number(row.points);
    }
    for (const row of assignments.filter((r) => r.broker === member.brokerId)) { const d = day(row.day); d.receivedLeads = Number(row.received); d.slaBreaches = Number(row.breaches); d.fastContacts = Number(row.fast); d.evidencedContacts = Number(row.evidenced); d.onTimeContacts = Number(row.ontime); }
    for (const row of services.filter((r) => r.broker === member.brokerId)) day(row.day).serviceLeads = Number(row.service);
    for (const row of notes.filter((r) => r.broker === member.brokerId)) day(row.day).validNotes = Number(row.notes);
    for (const row of offers.filter((r) => r.broker === member.brokerId)) { const d = day(row.day); d.offers = Number(row.offers); d.fastAcceptedOffers = Number(row.accepted); }
    for (const row of tasks.filter((r) => r.broker === member.brokerId)) { const d = day(row.day); d.returnsDue = Number(row.due); d.overdueReturns = Number(row.overdue); }
    for (const row of stages.filter((r) => r.broker === member.brokerId)) { const d = day(row.day); d.stageEligibleLeads = Number(row.eligible); d.stagedLeads = Number(row.staged); }
    const rows = roster.filter((r) => r.brokerId === member.brokerId);
    const first = [shiftJourneyDay(journeyWeek(now).startsAt, -7), ...rows.map((r) => journeyDay(r.validFrom))].sort()[0]!;
    const dutyScheduleIds = new Set<string>();
    for (let date = first; date <= today; date = shiftJourneyDay(date, 1)) {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const matching = rows.filter((r) => (r.dutyDate === date || (r.dutyDate === null && r.dayOfWeek === weekday)) && isValidOn(r, date) && isValidOn({ startsAt: r.startsAt, timezone: r.timezone, validFrom: r.scheduleFrom, validUntil: r.scheduleUntil }, date));
      const published = monthly === "true" ? new Set(matching.filter((r) => r.monthlyPlanId && r.dutyDate === date).map((r) => r.scheduleId)) : null;
      const effective = selectEffectiveDutyAssignments(matching, date, published);
      if (effective.length) { day(date).hasDuty = true; if (date === today) for (const r of effective) dutyScheduleIds.add(r.scheduleId); }
    }
    day(today);
    for (const p of presences.filter((p) => p.brokerId === member.brokerId)) if (p.status === "confirmed" && !p.confirmedBy) day(p.date).confirmedPresence = true;
    const ordered = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    const bestPresence = confirmedPresenceSequence(presences.filter((p) => p.brokerId === member.brokerId), today);
    const weeks = new Map<string, { received: number; breaches: number }>();
    for (const d of ordered) {
      const w = journeyWeek(new Date(`${d.date}T12:00:00Z`));
      if (w.endsAt > today) continue;
      const v = weeks.get(w.periodKey) ?? { received: 0, breaches: 0 };
      v.received += d.receivedLeads; v.breaches += d.slaBreaches; weeks.set(w.periodKey, v);
    }
    const sale = sales.find((s) => s.broker === member.brokerId);
    return { subject: { ...member, dutyScheduleIds: [...dutyScheduleIds] }, days: ordered, totalPoints, pointsByDay, evidence: {
      fastContacts: ledger.filter((r) => r.broker === member.brokerId).reduce((n, r) => n + Number(r.fast), 0), consecutivePresences: bestPresence,
      onTimeReturns: ordered.reduce((n, d) => n + d.returnsCompletedOnTime, 0),
      fullWeeksWithoutSlaBreach: [...weeks.values()].filter((w) => w.received > 0 && w.breaches === 0).length,
      approvedSales: Number(sale?.total ?? 0), approvedFamilySales: Number(sale?.family ?? 0), approvedBusinessSales: Number(sale?.business ?? 0), approvedColdLeadSales: 0,
    } };
  });
}
