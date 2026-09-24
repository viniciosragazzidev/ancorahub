import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, lt, or } from "drizzle-orm";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { enqueueMetaTemplateMessage } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { formatDutyStartHour, getRelevantDutyWindow, isConfirmationForActiveOccurrence, isDutyWindowActive, type DutyWindow } from "./duty-presence-domain";

type PresenceAssignment = { id: string; scheduleId: string; brokerId: string; dayOfWeek: number; startsAt: string; endsAt: string; validFrom: Date; validUntil: Date | null };
type PresenceSchedule = { id: string; dayOfWeek: number; startsAt: string; endsAt: string; timezone: string; validFrom: Date; validUntil: Date | null };

export async function isDutyPresenceConfirmationEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION)) === "true";
}

function getWindow(schedule: PresenceSchedule, now: Date): DutyWindow | null {
  const window = getRelevantDutyWindow(schedule, now);
  if (!window || window.startsAt < schedule.validFrom || (schedule.validUntil && window.startsAt >= schedule.validUntil)) return null;
  return window;
}

/** Restricts a currently active roster to exact, tenant-scoped confirmed occurrences. */
export async function getPresenceConfirmedAssignmentIds(input: {
  tenantId: string;
  assignments: PresenceAssignment[];
  schedules: PresenceSchedule[];
  now: Date;
}) {
  if (!input.assignments.length) return new Set<string>();
  if (!(await isDutyPresenceConfirmationEnabled())) return new Set(input.assignments.map((assignment) => assignment.id));

  const scheduleById = new Map(input.schedules.map((schedule) => [schedule.id, schedule]));
  const occurrences = input.assignments.flatMap((assignment) => {
    const schedule = scheduleById.get(assignment.scheduleId);
    if (!schedule) return [];
    const window = getWindow({ ...schedule, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt, endsAt: assignment.endsAt, validFrom: assignment.validFrom, validUntil: assignment.validUntil }, input.now);
    return window && isDutyWindowActive(window, input.now) ? [{ assignment, schedule, window }] : [];
  });
  if (!occurrences.length) return new Set<string>();

  const confirmationRows = await getDatabase()
    .select({
      assignmentId: schema.dutyPresenceConfirmations.assignmentId,
      scheduleId: schema.dutyPresenceConfirmations.scheduleId,
      brokerId: schema.dutyPresenceConfirmations.brokerId,
      dutyDate: schema.dutyPresenceConfirmations.dutyDate,
      shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
      shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
      status: schema.dutyPresenceConfirmations.status,
    })
    .from(schema.dutyPresenceConfirmations)
    .where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
      eq(schema.dutyPresenceConfirmations.status, "confirmed"),
      gt(schema.dutyPresenceConfirmations.shiftEndsAt, input.now),
      inArray(schema.dutyPresenceConfirmations.assignmentId, occurrences.map(({ assignment }) => assignment.id)),
    ));
  const confirmationByAssignment = new Map(confirmationRows.map((row) => [row.assignmentId, row]));
  return new Set(occurrences
    .filter(({ assignment, window }) => {
      const confirmation = confirmationByAssignment.get(assignment.id);
      return isConfirmationForActiveOccurrence({ confirmation, assignment, window, now: input.now });
    })
    .map(({ assignment }) => assignment.id));
}

/** Creates idempotent occurrence records and sends the approved Meta template before each shift. */
export async function processDutyPresenceReminders(now = new Date()) {
  if (!(await isDutyPresenceConfirmationEnabled())) return { enabled: false, considered: 0, queued: 0, failed: 0, expired: 0 };
  const db = getDatabase();
  const expiredRows = await db.update(schema.dutyPresenceConfirmations)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(schema.dutyPresenceConfirmations.status, "pending"), lte(schema.dutyPresenceConfirmations.shiftEndsAt, now)))
    .returning({ id: schema.dutyPresenceConfirmations.id });

  const schedules = await db.select({
    id: schema.unitDutySchedules.id,
    dayOfWeek: schema.unitDutySchedules.dayOfWeek,
    startsAt: schema.unitDutySchedules.startsAt,
    endsAt: schema.unitDutySchedules.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    validFrom: schema.unitDutySchedules.validFrom,
    validUntil: schema.unitDutySchedules.validUntil,
    tenantId: schema.unitDutySchedules.tenantId,
  }).from(schema.unitDutySchedules)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.unitDutySchedules.tenantId))
    .where(and(eq(schema.unitDutySchedules.status, "active"), eq(schema.tenants.status, "active"), lte(schema.unitDutySchedules.validFrom, now), or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now))));
  if (!schedules.length) return { enabled: true, considered: 0, queued: 0, failed: 0, expired: expiredRows.length };

  const assignments = await db.select({
    id: schema.dutyRosterAssignments.id,
    tenantId: schema.dutyRosterAssignments.tenantId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    brokerName: schema.user.name,
    phone: schema.brokerProfiles.phone,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
    .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.dutyRosterAssignments.brokerId), eq(schema.tenantMemberships.tenantId, schema.dutyRosterAssignments.tenantId)))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.dutyRosterAssignments.brokerId), eq(schema.brokerProfiles.tenantId, schema.dutyRosterAssignments.tenantId)))
    .where(and(
      eq(schema.dutyRosterAssignments.status, "active"),
      inArray(schema.dutyRosterAssignments.scheduleId, schedules.map((schedule) => schedule.id)),
      eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true), eq(schema.user.status, "active"),
    ));

  const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  let considered = 0;
  let queued = 0;
  let failed = 0;
  for (const assignment of assignments) {
    const schedule = scheduleById.get(assignment.scheduleId);
    if (!schedule || schedule.tenantId !== assignment.tenantId) continue;
    const window = getWindow({
      id: schedule.id, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt,
      endsAt: assignment.endsAt, timezone: schedule.timezone,
      validFrom: assignment.validFrom, validUntil: assignment.validUntil,
    }, now);
    // Do not create reminders outside the 30-minute pre-shift window or active shift.
    if (!window) continue;
    const reminderOpensAt = new Date(window.startsAt.getTime() - 30 * 60_000);
    if (now < reminderOpensAt || now >= window.endsAt) continue;
    considered += 1;
    const confirmationId = randomUUID();
    const [inserted] = await db.insert(schema.dutyPresenceConfirmations).values({
      id: confirmationId,
      tenantId: assignment.tenantId,
      scheduleId: assignment.scheduleId,
      assignmentId: assignment.id,
      brokerId: assignment.brokerId,
      dutyDate: window.dutyDate,
      shiftStartsAt: window.startsAt,
      shiftEndsAt: window.endsAt,
      status: "pending",
      notificationStatus: "pending",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().returning({ id: schema.dutyPresenceConfirmations.id });
    const [record] = inserted
      ? await db.select({ id: schema.dutyPresenceConfirmations.id, notificationStatus: schema.dutyPresenceConfirmations.notificationStatus, notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode }).from(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.id, inserted.id)).limit(1)
      : await db.select({ id: schema.dutyPresenceConfirmations.id, notificationStatus: schema.dutyPresenceConfirmations.notificationStatus, notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode }).from(schema.dutyPresenceConfirmations).where(and(
        eq(schema.dutyPresenceConfirmations.tenantId, assignment.tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, assignment.id), eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate),
        eq(schema.dutyPresenceConfirmations.shiftStartsAt, window.startsAt), eq(schema.dutyPresenceConfirmations.shiftEndsAt, window.endsAt),
      )).limit(1);
    if (!record || record.notificationStatus === "queued" || record.notificationStatus === "sent"
      || record.notificationErrorCode === "OUTBOX_DELIVERY_FAILED"
      || record.notificationErrorCode === "TEMPLATE_DELIVERY_FAILED") continue;
    const staleDispatchCutoff = new Date(now.getTime() - 5 * 60_000);
    const [claimed] = await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "dispatching", updatedAt: now }).where(and(
      eq(schema.dutyPresenceConfirmations.id, record.id),
      or(
        inArray(schema.dutyPresenceConfirmations.notificationStatus, ["pending", "error"]),
        and(eq(schema.dutyPresenceConfirmations.notificationStatus, "dispatching"), lt(schema.dutyPresenceConfirmations.updatedAt, staleDispatchCutoff)),
      ),
    )).returning({ id: schema.dutyPresenceConfirmations.id });
    if (!claimed) continue;
    try {
      if (!assignment.phone) throw new Error("BROKER_PHONE_UNAVAILABLE");
      const delivery = await enqueueMetaTemplateMessage({
        tenantId: assignment.tenantId,
        recipientType: "user",
        recipientId: assignment.brokerId,
        destinationPhone: assignment.phone,
        purpose: "dutyPresenceConfirmation",
        variables: [assignment.brokerName, formatDutyStartHour(window.startsAt, schedule.timezone), record.id],
        requestedBy: null,
        idempotencyKey: `duty-presence:${record.id}`,
      });
      if (["failed", "cancelled", "expired"].includes(delivery.status)) {
        await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: "OUTBOX_DELIVERY_FAILED", updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
        failed += 1;
        continue;
      }
      const delivered = ["sent", "delivered", "read"].includes(delivery.status);
      await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: delivered ? "sent" : "queued", notificationErrorCode: null, updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
      queued += delivery.duplicate ? 0 : 1;
    } catch (error) {
      const safeCode = error instanceof Error && error.message === "BROKER_PHONE_UNAVAILABLE" ? "BROKER_PHONE_UNAVAILABLE" : "TEMPLATE_DELIVERY_UNAVAILABLE";
      await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: safeCode, updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
      failed += 1;
    }
  }
  return { enabled: true, considered, queued, failed, expired: expiredRows.length };
}
