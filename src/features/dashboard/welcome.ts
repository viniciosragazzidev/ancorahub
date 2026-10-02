import "server-only";

import { and, eq, gt, gte, inArray, isNull, or, sql } from "drizzle-orm";

import { getPublishedDutyScheduleIds, getSaoPauloDateKey, selectEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { pickBusiestRunning, pickNextDuty, upcomingShift, type RunningDutyActivity } from "./welcome-rules";

export type DashboardDuty = {
  scheduleId: string;
  name: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  running: boolean;
  queueName: string | null;
  brokerCount: number;
  minimumBrokers: number;
};

export type DashboardWelcome = {
  firstName: string | null;
  nextDuty: DashboardDuty | null;
  /** Every plantão running now (several can run at once, e.g. PME and PRESENCIAL). */
  runningDuties?: DashboardDuty[];
  pulse: { activeQueues: number; runningDuties: number; brokersOnDutyNow: number };
};

/**
 * Data for the dashboard's welcome band: who is looking, the plantão running
 * now (or the next one) and whether distribution has queues and people on duty.
 */
export async function getDashboardWelcome(context: TenantContext, now = new Date()): Promise<DashboardWelcome> {
  const db = getDatabase();
  const [userRows, schedules, queues] = await Promise.all([
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db
      .select({
        id: schema.unitDutySchedules.id,
        name: schema.unitDutySchedules.name,
        dayOfWeek: schema.unitDutySchedules.dayOfWeek,
        startsAt: schema.unitDutySchedules.startsAt,
        endsAt: schema.unitDutySchedules.endsAt,
        timezone: schema.unitDutySchedules.timezone,
        validFrom: schema.unitDutySchedules.validFrom,
        validUntil: schema.unitDutySchedules.validUntil,
        minimumBrokers: schema.unitDutySchedules.minimumBrokers,
        queueId: schema.unitDutySchedules.queueId,
      })
      .from(schema.unitDutySchedules)
      .where(and(
        eq(schema.unitDutySchedules.tenantId, context.tenantId),
        eq(schema.unitDutySchedules.status, "active"),
        or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now)),
      )),
    db
      .select({
        id: schema.leadQueues.id,
        name: schema.leadQueues.name,
        status: schema.leadQueues.status,
        exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds,
        exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
      })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt))),
  ]);

  let next = pickNextDuty(schedules, now);
  const running = schedules.filter((schedule) => upcomingShift(schedule, now)?.running);
  const scheduleIds = [...new Set([...(next ? [next.schedule.id] : []), ...running.map((schedule) => schedule.id)])];

  const today = getSaoPauloDateKey(now);
  const [assignments, publishedToday, publishedOnNext] = scheduleIds.length
    ? await Promise.all([
        db
          .select({
            scheduleId: schema.dutyRosterAssignments.scheduleId,
            brokerId: schema.dutyRosterAssignments.brokerId,
            dutyDate: schema.dutyRosterAssignments.dutyDate,
            pausedAt: schema.dutyRosterAssignments.pausedAt,
          })
          .from(schema.dutyRosterAssignments)
          .where(and(
            eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
            eq(schema.dutyRosterAssignments.status, "active"),
            inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds),
          )),
        getPublishedDutyScheduleIds(context.tenantId, today),
        next && next.shift.dutyDate !== today ? getPublishedDutyScheduleIds(context.tenantId, next.shift.dutyDate) : Promise.resolve(undefined),
      ])
    : [[], null, undefined];

  const brokersOn = (ids: ReadonlySet<string>, dutyDate: string, published: ReadonlySet<string> | null) =>
    new Set(
      selectEffectiveDutyAssignments(assignments.filter((row) => ids.has(row.scheduleId) && !row.pausedAt), dutyDate, published)
        .map((row) => row.brokerId),
    ).size;

  // Several plantões running at once: show the busiest (confirmed brokers,
  // then leads today), not just the first to have started.
  if (running.length > 1) {
    const runningIds = running.map((schedule) => schedule.id);
    const queuesOf = (scheduleId: string) => queues.filter((queue) => queue.exclusiveDutyScheduleIds.includes(scheduleId) || queue.exclusiveDutyScheduleId === scheduleId).map((queue) => queue.id);
    const allQueueIds = [...new Set(runningIds.flatMap(queuesOf))];
    const [confirmedRows, leadRows] = await Promise.all([
      db.select({ scheduleId: schema.dutyPresenceConfirmations.scheduleId, total: sql<number>`count(distinct ${schema.dutyPresenceConfirmations.brokerId})::int` })
        .from(schema.dutyPresenceConfirmations)
        .where(and(
          eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
          inArray(schema.dutyPresenceConfirmations.scheduleId, runningIds),
          eq(schema.dutyPresenceConfirmations.dutyDate, today),
          eq(schema.dutyPresenceConfirmations.status, "confirmed"),
        ))
        .groupBy(schema.dutyPresenceConfirmations.scheduleId),
      allQueueIds.length
        ? db.select({ queueId: schema.leads.queueId, total: sql<number>`count(*)::int` })
          .from(schema.leads)
          .where(and(
            eq(schema.leads.tenantId, context.tenantId),
            inArray(schema.leads.queueId, allQueueIds),
            gte(schema.leads.createdAt, new Date(`${today}T03:00:00Z`)),
            isNull(schema.leads.deletedAt),
          ))
          .groupBy(schema.leads.queueId)
        : Promise.resolve([]),
    ]);
    const confirmedBySchedule = new Map(confirmedRows.map((row) => [row.scheduleId, Number(row.total)]));
    const leadsByQueue = new Map(leadRows.map((row) => [row.queueId, Number(row.total)]));
    const activity = new Map<string, RunningDutyActivity>(runningIds.map((id) => [id, {
      confirmedBrokers: confirmedBySchedule.get(id) ?? 0,
      leadsToday: queuesOf(id).reduce((sum, queueId) => sum + (leadsByQueue.get(queueId) ?? 0), 0),
      brokers: brokersOn(new Set([id]), today, publishedToday),
    }]));
    const candidates = running.flatMap((schedule) => {
      const shift = upcomingShift(schedule, now);
      return shift ? [{ schedule, shift }] : [];
    });
    next = pickBusiestRunning(candidates, activity) ?? next;
  }

  const queueFor = (scheduleId: string, legacyQueueId: string | null) => {
    const linked = queues.find((queue) => queue.exclusiveDutyScheduleIds.includes(scheduleId) || queue.exclusiveDutyScheduleId === scheduleId);
    return linked?.name ?? queues.find((queue) => queue.id === legacyQueueId)?.name ?? null;
  };

  return {
    firstName: userRows[0]?.name?.trim().split(/\s+/)[0] ?? null,
    nextDuty: next
      ? {
          scheduleId: next.schedule.id,
          name: next.schedule.name,
          dutyDate: next.shift.dutyDate,
          startsAt: next.schedule.startsAt.slice(0, 5),
          endsAt: next.schedule.endsAt.slice(0, 5),
          running: next.shift.running,
          queueName: queueFor(next.schedule.id, next.schedule.queueId),
          brokerCount: brokersOn(new Set([next.schedule.id]), next.shift.dutyDate, next.shift.dutyDate === today ? publishedToday : publishedOnNext ?? null),
          minimumBrokers: next.schedule.minimumBrokers,
        }
      : null,
    runningDuties: running
      .flatMap((schedule) => {
        const shift = upcomingShift(schedule, now);
        return shift?.running ? [{
          scheduleId: schedule.id,
          name: schedule.name,
          dutyDate: shift.dutyDate,
          startsAt: schedule.startsAt.slice(0, 5),
          endsAt: schedule.endsAt.slice(0, 5),
          running: true,
          queueName: queueFor(schedule.id, schedule.queueId),
          brokerCount: brokersOn(new Set([schedule.id]), shift.dutyDate, publishedToday),
          minimumBrokers: schedule.minimumBrokers,
        }] : [];
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.name.localeCompare(b.name, "pt-BR")),
    pulse: {
      activeQueues: queues.filter((queue) => queue.status === "active").length,
      runningDuties: running.length,
      brokersOnDutyNow: brokersOn(new Set(running.map((schedule) => schedule.id)), today, publishedToday),
    },
  };
}
