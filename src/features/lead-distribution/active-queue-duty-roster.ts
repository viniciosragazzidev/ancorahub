import "server-only";

import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { getLocalDutyParts } from "@/features/leads/assignment";
import { getDatabase, schema } from "@/shared/db";
import { selectMatchingDutyScheduleIds, selectQueueLinkedDutySchedules } from "./duty-roster-matching";
import { getPresenceEligibleAssignments } from "./duty-presence";
import { resolveEffectiveDutyAssignments } from "./dated-duty-roster";
import { selectBrokerDutyScheduleIds } from "./shared-duty-roster";
import { countLeadsReceivedInDuty, type DutyLeadCap } from "./duty-lead-cap";
import { findRunningDutySchedule } from "./duty-presence-domain";

export type ActiveQueueDutyBroker = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  scheduleId: string;
};

export type ActiveQueueDutyRoster = {
  hasActiveDuty: boolean;
  brokers: ActiveQueueDutyBroker[];
};

const noActiveDuty: ActiveQueueDutyRoster = { hasActiveDuty: false, brokers: [] };

/**
 * Resolves the active roster of a lead's queue without narrowing by unit.
 * Queue/tenant, current duty window, source credential, active roster entries,
 * and active team membership are all revalidated here on the server.
 */
export async function getActiveQueueDutyRoster(input: {
  tenantId: string;
  queueId: string | null;
  webhookCredentialId: string | null;
  now?: Date;
  respectDutyCap?: boolean;
  includePaused?: boolean;
}): Promise<ActiveQueueDutyRoster> {
  if (!input.queueId) return noActiveDuty;

  const db = getDatabase();
  const now = input.now ?? new Date();
  const [queue] = await db
    .select({
      exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
      exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds,
    })
    .from(schema.leadQueues)
    .where(and(
      eq(schema.leadQueues.id, input.queueId),
      eq(schema.leadQueues.tenantId, input.tenantId),
      eq(schema.leadQueues.status, "active"),
      isNull(schema.leadQueues.deletedAt),
    ))
    .limit(1);
  if (!queue) return noActiveDuty;

  const linkedScheduleIds = Array.from(new Set([
    ...(Array.isArray(queue.exclusiveDutyScheduleIds) ? queue.exclusiveDutyScheduleIds : []),
    ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : []),
  ]));
  const local = getLocalDutyParts(now);
  const queueScheduleLink = linkedScheduleIds.length
    ? or(
      inArray(schema.unitDutySchedules.id, linkedScheduleIds),
      eq(schema.unitDutySchedules.queueId, input.queueId),
    )
    : eq(schema.unitDutySchedules.queueId, input.queueId);
  const activeSchedules = await db
    .select({
      id: schema.unitDutySchedules.id,
      queueId: schema.unitDutySchedules.queueId,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      timezone: schema.unitDutySchedules.timezone,
      attendanceMode: schema.unitDutySchedules.attendanceMode,
      maxLeadsPerBroker: schema.unitDutySchedules.maxLeadsPerBroker,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
    })
    .from(schema.unitDutySchedules)
    .where(and(
      eq(schema.unitDutySchedules.tenantId, input.tenantId),
      eq(schema.unitDutySchedules.status, "active"),
      eq(schema.unitDutySchedules.dayOfWeek, local.weekday),
      lte(schema.unitDutySchedules.startsAt, local.time),
      gt(schema.unitDutySchedules.endsAt, local.time),
      lte(schema.unitDutySchedules.validFrom, now),
      or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now)),
      queueScheduleLink,
    ));

  const queueActiveSchedules = selectQueueLinkedDutySchedules(activeSchedules, input.queueId, linkedScheduleIds);
  const matchingScheduleIds = selectMatchingDutyScheduleIds(queueActiveSchedules, input.webhookCredentialId);
  if (!matchingScheduleIds.length) return noActiveDuty;

  const brokers = await db
    .selectDistinct({
      id: schema.user.id,
      assignmentId: schema.dutyRosterAssignments.id,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      validFrom: schema.dutyRosterAssignments.validFrom,
      validUntil: schema.dutyRosterAssignments.validUntil,
      name: schema.user.name,
      branchId: schema.dutyRosterAssignments.branchId,
      branchName: schema.branches.name,
      dutyDate: schema.dutyRosterAssignments.dutyDate,
      pausedAt: schema.dutyRosterAssignments.pausedAt,
    })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.tenantMemberships, and(
      eq(schema.tenantMemberships.userId, schema.dutyRosterAssignments.brokerId),
      eq(schema.tenantMemberships.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
    .innerJoin(schema.branches, and(
      eq(schema.branches.id, schema.dutyRosterAssignments.branchId),
      eq(schema.branches.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
      eq(schema.dutyRosterAssignments.status, "active"),
      input.includePaused ? undefined : isNull(schema.dutyRosterAssignments.pausedAt),
      eq(schema.dutyRosterAssignments.dayOfWeek, local.weekday),
      lte(schema.dutyRosterAssignments.startsAt, local.time),
      gt(schema.dutyRosterAssignments.endsAt, local.time),
      lte(schema.dutyRosterAssignments.validFrom, now),
      or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
      inArray(schema.dutyRosterAssignments.scheduleId, matchingScheduleIds),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
      eq(schema.branches.status, "active"),
    ))
    .orderBy(asc(schema.user.name));

  // brokerId: weekly and published rows of the same broker count once (they add up per broker).
  const effectiveBrokers = await resolveEffectiveDutyAssignments(input.tenantId, brokers.map((broker) => ({ ...broker, brokerId: broker.id })), now);
  const effectiveAssignmentIds = new Set(effectiveBrokers.map((assignment) => assignment.assignmentId));
  const presence = await getPresenceEligibleAssignments({
    tenantId: input.tenantId,
    assignments: brokers.filter((broker) => effectiveAssignmentIds.has(broker.assignmentId)).map((broker) => ({
      id: broker.assignmentId,
      scheduleId: broker.scheduleId,
      brokerId: broker.id,
      dayOfWeek: broker.dayOfWeek,
      startsAt: broker.startsAt,
      endsAt: broker.endsAt,
      validFrom: broker.validFrom,
      validUntil: broker.validUntil,
    })),
    schedules: activeSchedules.filter((schedule) => matchingScheduleIds.includes(schedule.id)),
    now,
  });
  const capBySchedule = new Map<string, DutyLeadCap>();
  if (input.respectDutyCap !== false) {
    for (const schedule of activeSchedules) {
      const running = findRunningDutySchedule([schedule], now);
      if (running && schedule.maxLeadsPerBroker) capBySchedule.set(schedule.id, {
        scheduleId: schedule.id,
        limit: schedule.maxLeadsPerBroker,
        startsAt: running.window.startsAt,
        endsAt: running.window.endsAt,
      });
    }
  }
  const receivedBySchedule = new Map<string, Map<string, number>>();
  await Promise.all([...capBySchedule.values()].map(async (cap) => {
    const brokerIds = [...new Set(effectiveBrokers
      .filter((broker) => broker.scheduleId === cap.scheduleId && presence.eligibleAssignmentIds.has(broker.assignmentId))
      .map((broker) => broker.id))];
    if (brokerIds.length) receivedBySchedule.set(cap.scheduleId, await countLeadsReceivedInDuty(db, input.tenantId, cap, brokerIds));
  }));
  const eligibleAssignmentIds = new Set(effectiveBrokers.flatMap((broker) => {
    if (!presence.eligibleAssignmentIds.has(broker.assignmentId)) return [];
    const cap = input.respectDutyCap === false ? null : capBySchedule.get(broker.scheduleId);
    return !cap || (receivedBySchedule.get(broker.scheduleId)?.get(broker.id) ?? 0) < cap.limit ? [broker.assignmentId] : [];
  }));
  // Resolve attribution after applying each occurrence's cap: a full schedule
  // must not remove a broker who has another shared occurrence with capacity.
  const scheduleIdByBroker = selectBrokerDutyScheduleIds(
    effectiveBrokers.map((broker) => ({ id: broker.assignmentId, brokerId: broker.id, scheduleId: broker.scheduleId })),
    new Set(matchingScheduleIds),
    eligibleAssignmentIds,
    presence.confirmedPresenceAssignmentIds,
  );
  return {
    hasActiveDuty: true,
    brokers: brokers.filter((broker) => effectiveAssignmentIds.has(broker.assignmentId) && presence.eligibleAssignmentIds.has(broker.assignmentId) && scheduleIdByBroker.get(broker.id) === broker.scheduleId).map((broker) => ({ id: broker.id, scheduleId: broker.scheduleId, name: broker.name, branchId: broker.branchId, branchName: broker.branchName })),
  };
}
