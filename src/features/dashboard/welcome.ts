import "server-only";

import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { getPublishedDutyScheduleIds, getSaoPauloDateKey, selectEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { pickNextDuty, upcomingShift } from "./welcome-rules";

export type DashboardWelcome = {
  firstName: string | null;
  nextDuty: {
    scheduleId: string;
    name: string;
    dutyDate: string;
    startsAt: string;
    endsAt: string;
    running: boolean;
    queueName: string | null;
    brokerCount: number;
    minimumBrokers: number;
  } | null;
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

  const next = pickNextDuty(schedules, now);
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
    pulse: {
      activeQueues: queues.filter((queue) => queue.status === "active").length,
      runningDuties: running.length,
      brokersOnDutyNow: brokersOn(new Set(running.map((schedule) => schedule.id)), today, publishedToday),
    },
  };
}
