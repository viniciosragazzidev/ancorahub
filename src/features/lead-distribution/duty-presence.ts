import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, lt, ne, or, sql } from "drizzle-orm";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { DEFAULT_EXTRA_SHIFT_STARTS_AT, effectiveAttendanceMode, extendedShiftHourLabel, extraShiftWindow, findDutyOccurrenceConfirmation, formatDutyPresenceHourLabel, getRelevantDutyWindow, getSelfDutyConfirmationWindowState, isConfirmationForActiveOccurrence, isDutyBrokerEligible, isDutyWindowActive, type DutyWindow } from "./duty-presence-domain";
import { getPublishedDutyScheduleIds, getSaoPauloDateKey, selectEffectiveDutyAssignments } from "./dated-duty-roster";

export { SELF_CONFIRM_LATE_MESSAGE, SELF_CONFIRM_OPENS_MINUTES, SELF_CONFIRM_TOLERANCE_MINUTES } from "./duty-presence-domain";

// attendanceMode: the per-broker override (NULL/absent follows the schedule).
type PresenceAssignment = { id: string; scheduleId: string; brokerId: string; dayOfWeek: number; startsAt: string; endsAt: string; validFrom: Date; validUntil: Date | null; attendanceMode?: string | null };
type PresenceSchedule = { id: string; dayOfWeek: number; startsAt: string; endsAt: string; timezone: string; validFrom: Date; validUntil: Date | null; attendanceMode?: string };

export async function isDutyPresenceConfirmationEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION)) === "true";
}

/** Plantão rotation (29/10): off, the plantão goes back to the DEC-154 leveling. */
export async function isDutyRotationEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_ROTATION).catch(() => "true")) === "true";
}

/** Plantão extra dos leads da noite (DEC-152): ligado pelo Super-admin, com horário de início. */
export async function getOvernightExtraShiftSettings(): Promise<{ enabled: boolean; startsAt: string }> {
  const [enabled, startsAt] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.DUTY_OVERNIGHT_EXTRA_SHIFT).catch(() => "false"),
    getFeatureFlag(FEATURE_FLAGS.DUTY_OVERNIGHT_EXTRA_STARTS_AT).catch(() => DEFAULT_EXTRA_SHIFT_STARTS_AT),
  ]);
  const allowed = FEATURE_FLAGS.DUTY_OVERNIGHT_EXTRA_STARTS_AT.allowedValues as readonly string[];
  return { enabled: enabled === "true", startsAt: allowed.includes(startsAt) ? startsAt : DEFAULT_EXTRA_SHIFT_STARTS_AT };
}

function getWindow(schedule: PresenceSchedule, now: Date): DutyWindow | null {
  const window = getRelevantDutyWindow(schedule, now);
  if (!window || window.startsAt < schedule.validFrom || (schedule.validUntil && window.startsAt >= schedule.validUntil)) return null;
  return window;
}

/** Restricts a roster to eligible occurrences and identifies explicit check-ins. */
export async function getPresenceEligibleAssignments(input: {
  tenantId: string;
  assignments: PresenceAssignment[];
  schedules: PresenceSchedule[];
  now: Date;
}) {
  if (!input.assignments.length) return { eligibleAssignmentIds: new Set<string>(), confirmedPresenceAssignmentIds: new Set<string>(), arrivedAtByAssignment: new Map<string, Date>() };
  const presenceRequired = await isDutyPresenceConfirmationEnabled();

  const scheduleById = new Map(input.schedules.map((schedule) => [schedule.id, schedule]));
  const occurrences = input.assignments.flatMap((assignment) => {
    const schedule = scheduleById.get(assignment.scheduleId);
    if (!schedule) return [];
    const window = getWindow({ ...schedule, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt, endsAt: assignment.endsAt, validFrom: assignment.validFrom, validUntil: assignment.validUntil }, input.now);
    return window && isDutyWindowActive(window, input.now) ? [{ assignment, schedule, window }] : [];
  });
  if (!occurrences.length) return { eligibleAssignmentIds: new Set<string>(), confirmedPresenceAssignmentIds: new Set<string>(), arrivedAtByAssignment: new Map<string, Date>() };

  const confirmationRows = await getDatabase()
    .select({
      assignmentId: schema.dutyPresenceConfirmations.assignmentId,
      scheduleId: schema.dutyPresenceConfirmations.scheduleId,
      brokerId: schema.dutyPresenceConfirmations.brokerId,
      dutyDate: schema.dutyPresenceConfirmations.dutyDate,
      shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
      shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
      status: schema.dutyPresenceConfirmations.status,
      confirmedBy: schema.dutyPresenceConfirmations.confirmedBy,
      confirmedAt: schema.dutyPresenceConfirmations.confirmedAt,
      photoTakenAt: schema.dutyPresenceConfirmations.photoTakenAt,
    })
    .from(schema.dutyPresenceConfirmations)
    .where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
      gt(schema.dutyPresenceConfirmations.shiftEndsAt, input.now),
      inArray(schema.dutyPresenceConfirmations.assignmentId, occurrences.map(({ assignment }) => assignment.id)),
    ));
  const eligible = occurrences.filter(({ assignment, schedule, window }) => {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: confirmationRows, assignment, window, now: input.now });
      const attendanceMode = effectiveAttendanceMode(assignment.attendanceMode, schedule.attendanceMode);
      return isDutyBrokerEligible({ attendanceMode, presenceRequired, status: confirmation?.status ?? null, confirmedBy: confirmation?.confirmedBy ?? null })
        && (!(presenceRequired || attendanceMode === "presencial") || isConfirmationForActiveOccurrence({ confirmation, assignment, window, now: input.now }));
    });
  return {
    eligibleAssignmentIds: new Set(eligible.map(({ assignment }) => assignment.id)),
    confirmedPresenceAssignmentIds: new Set(eligible.flatMap(({ assignment, window }) => {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: confirmationRows, assignment, window, now: input.now });
      return confirmation?.status === "confirmed" && confirmation.confirmedBy ? [assignment.id] : [];
    })),
    // Rotation (29/10): when each eligible broker arrived, the confirmation time or, without one, the shift start.
    // Presencial (30/10): the photo time, not the approval: the wait for the approver is not the broker's.
    arrivedAtByAssignment: new Map(eligible.map(({ assignment, window }) => {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: confirmationRows, assignment, window, now: input.now });
      const arrivedAt = confirmation?.status === "confirmed" ? confirmation.photoTakenAt ?? confirmation.confirmedAt : null;
      return [assignment.id, arrivedAt ?? window.startsAt] as const;
    })),
  };
}

/** Backward-compatible view for callers that only need eligible assignment IDs. */
export async function getPresenceConfirmedAssignmentIds(input: Parameters<typeof getPresenceEligibleAssignments>[0]) {
  return (await getPresenceEligibleAssignments(input)).eligibleAssignmentIds;
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
    name: schema.unitDutySchedules.name,
    dayOfWeek: schema.unitDutySchedules.dayOfWeek,
    startsAt: schema.unitDutySchedules.startsAt,
    endsAt: schema.unitDutySchedules.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
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
    dutyDate: schema.dutyRosterAssignments.dutyDate,
    attendanceMode: schema.dutyRosterAssignments.attendanceMode,
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
  // Weekly and published add up (2026-10-09). A broker on both keeps only the
  // published row, so the check sees all his rows of the plantão at once:
  // one reminder per broker and shift, on the row distribution actually uses.
  const sameBrokerRows = new Map<string, typeof assignments>();
  for (const row of assignments) {
    const key = `${row.tenantId}|${row.scheduleId}|${row.brokerId}`;
    sameBrokerRows.set(key, [...(sameBrokerRows.get(key) ?? []), row]);
  }
  const publishedByTenantDate = new Map<string, Promise<Set<string> | null>>();
  const publishedFor = (tenantId: string, day: string) => {
    const key = `${tenantId}:${day}`;
    if (!publishedByTenantDate.has(key)) publishedByTenantDate.set(key, getPublishedDutyScheduleIds(tenantId, day));
    return publishedByTenantDate.get(key)!;
  };
  let considered = 0;
  let queued = 0;
  let failed = 0;
  const extraShift = await getOvernightExtraShiftSettings();
  type Assignment = (typeof assignments)[number];
  type Schedule = (typeof schedules)[number];
  const isEffectiveOn = async (assignment: Assignment, shiftDay: string) => {
    const group = sameBrokerRows.get(`${assignment.tenantId}|${assignment.scheduleId}|${assignment.brokerId}`) ?? [assignment];
    return selectEffectiveDutyAssignments(group, shiftDay, await publishedFor(assignment.tenantId, shiftDay)).some((row) => row.id === assignment.id);
  };

  /** One idempotent confirmation per occurrence (normal or extra) and its WhatsApp link. */
  const remind = async (assignment: Assignment, schedule: Schedule, window: DutyWindow, hourLabel: string) => {
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
      ? await db.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status, notificationStatus: schema.dutyPresenceConfirmations.notificationStatus, notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode }).from(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.id, inserted.id)).limit(1)
      : await db.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status, notificationStatus: schema.dutyPresenceConfirmations.notificationStatus, notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode }).from(schema.dutyPresenceConfirmations).where(and(
        eq(schema.dutyPresenceConfirmations.tenantId, assignment.tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, assignment.id), eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate),
        eq(schema.dutyPresenceConfirmations.shiftStartsAt, window.startsAt), eq(schema.dutyPresenceConfirmations.shiftEndsAt, window.endsAt),
      )).limit(1);
    // Already confirmed (e.g. released by a director/manager): no invite.
    if (!record || record.status === "confirmed" || record.status === "absent" || record.notificationStatus === "queued" || record.notificationStatus === "sent"
      || record.notificationErrorCode === "OUTBOX_DELIVERY_FAILED"
      || record.notificationErrorCode === "TEMPLATE_DELIVERY_FAILED") return;
    const staleDispatchCutoff = new Date(now.getTime() - 5 * 60_000);
    const [claimed] = await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "dispatching", updatedAt: now }).where(and(
      eq(schema.dutyPresenceConfirmations.id, record.id),
      or(
        inArray(schema.dutyPresenceConfirmations.notificationStatus, ["pending", "error"]),
        and(eq(schema.dutyPresenceConfirmations.notificationStatus, "dispatching"), lt(schema.dutyPresenceConfirmations.updatedAt, staleDispatchCutoff)),
      ),
    )).returning({ id: schema.dutyPresenceConfirmations.id });
    if (!claimed) return;
    try {
      if (!assignment.phone) throw new Error("BROKER_PHONE_UNAVAILABLE");
      const delivery = await enqueueMetaTemplateMessage({
        tenantId: assignment.tenantId,
        recipientType: "user",
        recipientId: assignment.brokerId,
        destinationPhone: assignment.phone,
        purpose: "dutyPresenceConfirmation",
        variables: [assignment.brokerName, hourLabel, record.id],
        requestedBy: null,
        idempotencyKey: `duty-presence:${record.id}`,
      });
      if (["failed", "cancelled", "expired"].includes(delivery.status)) {
        await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: "OUTBOX_DELIVERY_FAILED", updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
        failed += 1;
        return;
      }
      const delivered = ["sent", "delivered", "read"].includes(delivery.status);
      await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: delivered ? "sent" : "queued", notificationErrorCode: null, updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
      queued += delivery.duplicate ? 0 : 1;
    } catch (error) {
      const safeCode = error instanceof Error && error.message === "BROKER_PHONE_UNAVAILABLE" ? "BROKER_PHONE_UNAVAILABLE" : "TEMPLATE_DELIVERY_UNAVAILABLE";
      await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: safeCode, updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
      failed += 1;
    }
  };

  for (const assignment of assignments) {
    const schedule = scheduleById.get(assignment.scheduleId);
    // Presencial also gets the WhatsApp reminder (2026-10-12): its link opens the app, where the photo of the place confirms.
    if (!schedule || schedule.tenantId !== assignment.tenantId) continue;
    const weekly = {
      id: schedule.id, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt,
      endsAt: assignment.endsAt, timezone: schedule.timezone,
      validFrom: assignment.validFrom, validUntil: assignment.validUntil,
    };

    // Plantão extra (DEC-152): from the extra start until the morning shift begins, every broker on
    // that morning's roster gets a link saying it is an extra plantão for the night's leads.
    if (extraShift.enabled) {
      const upcoming = getRelevantDutyWindow(weekly, now, 6 * 60);
      const extra = upcoming ? extraShiftWindow(upcoming, schedule.timezone, extraShift.startsAt) : null;
      const valid = upcoming && upcoming.startsAt >= assignment.validFrom && (!assignment.validUntil || upcoming.startsAt < assignment.validUntil);
      if (upcoming && extra && valid && now >= extra.startsAt && now < extra.endsAt
        && await isEffectiveOn(assignment, getSaoPauloDateKey(upcoming.startsAt))) {
        const presencial = effectiveAttendanceMode(assignment.attendanceMode, schedule.attendanceMode) === "presencial";
        await remind(assignment, schedule, extra, extendedShiftHourLabel(extra.startsAt, schedule.timezone, schedule.name, presencial));
      }
    }

    const window = getWindow(weekly, now);
    // Do not create reminders outside the 30-minute pre-shift window or active shift.
    if (!window) continue;
    const reminderOpensAt = new Date(window.startsAt.getTime() - 30 * 60_000);
    if (now < reminderOpensAt || now >= window.endsAt) continue;
    if (!(await isEffectiveOn(assignment, getSaoPauloDateKey(window.startsAt)))) continue;
    await remind(assignment, schedule, window, formatDutyPresenceHourLabel(window.startsAt, schedule.timezone, schedule.name));
  }
  return { enabled: true, considered, queued, failed, expired: expiredRows.length };
}

/**
 * A director/manager releases a broker for the current (or next) occurrence of
 * their shift without the broker clicking the confirmation — e.g. an
 * in-person plantão checked on site. The broker is then eligible for offers
 * exactly as after their own click; who released it is kept.
 * Presencial (2026-10-12): with the broker's photo it is the validation of the
 * photo; without it, a written reason is required and kept (release_note).
 */
export async function releaseDutyPresenceManually(input: { tenantId: string; assignmentId: string; releasedBy: string; note?: string | null }, now = new Date()): Promise<{ ok: true } | { ok: false; reason: string; needsNote?: boolean }> {
  const db = getDatabase();
  const [assignment] = await db.select({
    id: schema.dutyRosterAssignments.id,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
    scheduleTimezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    assignmentAttendanceMode: schema.dutyRosterAssignments.attendanceMode,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
    .where(and(eq(schema.dutyRosterAssignments.id, input.assignmentId), eq(schema.dutyRosterAssignments.tenantId, input.tenantId), eq(schema.dutyRosterAssignments.status, "active")))
    .limit(1);
  if (!assignment) return { ok: false, reason: "Escalação não encontrada." };
  const window = getWindow({ id: assignment.scheduleId, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt, endsAt: assignment.endsAt, timezone: assignment.scheduleTimezone, validFrom: assignment.validFrom, validUntil: assignment.validUntil }, now);
  if (!window) return { ok: false, reason: "Não há turno deste corretor acontecendo agora ou a seguir." };

  const occurrence = and(
    eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
    eq(schema.dutyPresenceConfirmations.assignmentId, assignment.id),
    eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate),
    eq(schema.dutyPresenceConfirmations.shiftStartsAt, window.startsAt),
    eq(schema.dutyPresenceConfirmations.shiftEndsAt, window.endsAt),
  );
  const presencial = effectiveAttendanceMode(assignment.assignmentAttendanceMode, assignment.attendanceMode) === "presencial";
  const [current] = presencial
    ? await db.select({ hasPhoto: sql<boolean>`${schema.dutyPresenceConfirmations.photoStorageKey} is not null`, photoTakenAt: schema.dutyPresenceConfirmations.photoTakenAt }).from(schema.dutyPresenceConfirmations).where(occurrence).limit(1)
    : [];
  const withPhoto = Boolean(current?.hasPhoto);
  const note = input.note?.trim() ?? "";
  if (presencial && !withPhoto && note.length < 5) return { ok: false, reason: "Sem a foto do local: escreva o motivo para liberar.", needsNote: true };
  const released = await db.transaction(async (tx) => {
    await tx.insert(schema.dutyPresenceConfirmations).values({
      id: randomUUID(), tenantId: input.tenantId, scheduleId: assignment.scheduleId, assignmentId: assignment.id, brokerId: assignment.brokerId,
      dutyDate: window.dutyDate, shiftStartsAt: window.startsAt, shiftEndsAt: window.endsAt,
      status: "pending", notificationStatus: "pending", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const changed = await tx.update(schema.dutyPresenceConfirmations)
      .set({ status: "confirmed", confirmedAt: now, confirmedBy: input.releasedBy, releaseNote: presencial && !withPhoto ? note.slice(0, 300) : null, updatedAt: now })
      .where(and(occurrence, ne(schema.dutyPresenceConfirmations.status, "absent"), or(ne(schema.dutyPresenceConfirmations.status, "confirmed"), isNull(schema.dutyPresenceConfirmations.confirmedBy))))
      .returning({ id: schema.dutyPresenceConfirmations.id });
    if (!changed.length) return false;
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.releasedBy, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: !presencial ? "duty_presence.released_manually" : withPhoto ? "duty_presence.photo_validated" : "duty_presence.released_without_photo", createdAt: now });
    return true;
  });
  if (!released) return { ok: false, reason: "Corretor já liberado ou com falta registrada." };
  // The photo came on time (30/10): the broker takes the place in the rotation of an instant approval.
  if (withPhoto && current?.photoTakenAt && await isDutyRotationEnabled()) {
    const { applyApprovalDelayCatchup } = await import("./duty-approval-catchup-server");
    await applyApprovalDelayCatchup({ tenantId: input.tenantId, scheduleId: assignment.scheduleId, dutyDate: window.dutyDate, brokerId: assignment.brokerId, photoTakenAt: current.photoTakenAt, releasedBy: input.releasedBy, now });
  }
  // Leads waiting for an eligible broker get their turn now.
  const { wakeLeadsAwaitingEligibleBroker } = await import("./jobs");
  await wakeLeadsAwaitingEligibleBroker(input.tenantId).catch(() => 0);
  return { ok: true };
}

export type ManualDutyPresenceInviteResult =
  | { ok: true; delivered: boolean }
  | { ok: false; reason: string };

/**
 * Directors/managers can trigger this from the roster row — for a broker
 * added mid-shift (who missed the sweep's window) or to resend after a
 * delivery error, without waiting for the next cron pass. Unlike the sweep,
 * this always (re)sends: it does not skip an already-"sent" row.
 */
export async function sendDutyPresenceInviteManually(input: { tenantId: string; assignmentId: string; requestedBy: string }, now = new Date()): Promise<ManualDutyPresenceInviteResult> {
  if (!(await isDutyPresenceConfirmationEnabled())) return { ok: false, reason: "A confirmação de presença está desligada globalmente." };
  const db = getDatabase();

  const [assignment] = await db.select({
    id: schema.dutyRosterAssignments.id,
    tenantId: schema.dutyRosterAssignments.tenantId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    brokerName: schema.user.name,
    scheduleName: schema.unitDutySchedules.name,
    phone: schema.brokerProfiles.phone,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
    scheduleTimezone: schema.unitDutySchedules.timezone,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
    .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.dutyRosterAssignments.brokerId), eq(schema.brokerProfiles.tenantId, schema.dutyRosterAssignments.tenantId)))
    .where(and(
      eq(schema.dutyRosterAssignments.id, input.assignmentId),
      eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
      eq(schema.dutyRosterAssignments.status, "active"),
    ))
    .limit(1);
  if (!assignment) return { ok: false, reason: "Escalação não encontrada." };
  if (!assignment.phone) return { ok: false, reason: "Corretor sem telefone cadastrado." };

  const window = getWindow({ id: assignment.scheduleId, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt, endsAt: assignment.endsAt, timezone: assignment.scheduleTimezone, validFrom: assignment.validFrom, validUntil: assignment.validUntil }, now);
  if (!window) return { ok: false, reason: "Não há ocorrência de plantão ativa ou próxima para este corretor agora." };

  const confirmationId = randomUUID();
  const [inserted] = await db.insert(schema.dutyPresenceConfirmations).values({
    id: confirmationId,
    tenantId: input.tenantId,
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
  }).onConflictDoNothing().returning({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status });
  const record = inserted ?? (await db.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status }).from(schema.dutyPresenceConfirmations).where(and(
    eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
    eq(schema.dutyPresenceConfirmations.assignmentId, assignment.id),
    eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate),
    eq(schema.dutyPresenceConfirmations.shiftStartsAt, window.startsAt),
    eq(schema.dutyPresenceConfirmations.shiftEndsAt, window.endsAt),
  )).limit(1))[0];
  if (!record) return { ok: false, reason: "Não foi possível preparar a confirmação." };
  if (record.status === "absent") return { ok: false, reason: "Corretor com falta registrada nesta ocorrência." };

  await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "dispatching", updatedAt: now }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
  try {
    const outbound = await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      recipientId: assignment.brokerId,
      destinationPhone: assignment.phone,
      purpose: "dutyPresenceConfirmation",
      variables: [assignment.brokerName, formatDutyPresenceHourLabel(window.startsAt, assignment.scheduleTimezone, assignment.scheduleName), record.id],
      requestedBy: input.requestedBy,
      // A fresh key per manual click — the idempotency key from the sweep
      // (`duty-presence:${record.id}`) may already have been consumed for
      // this same confirmation row, and a resend is a deliberate new attempt.
      idempotencyKey: `duty-presence-manual:${record.id}:${now.getTime()}`,
    });
    const delivery = await processMetaOutboundBatch(1, input.tenantId, outbound.id);
    const failedNow = delivery.failed > 0 && delivery.sent === 0;
    await db.update(schema.dutyPresenceConfirmations).set({
      notificationStatus: failedNow ? "error" : "sent",
      notificationErrorCode: failedNow ? "OUTBOX_DELIVERY_FAILED" : null,
      updatedAt: new Date(),
    }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: input.requestedBy, entidade: "duty_presence_confirmation", entidadeId: record.id,
      acao: failedNow ? "duty_presence.manual_invite_failed" : "duty_presence.manual_invite_sent",
    });
    if (failedNow) return { ok: false, reason: "O envio falhou no provedor. Tente novamente em instantes." };
    return { ok: true, delivered: delivery.sent > 0 };
  } catch (error) {
    const safeCode = error instanceof Error && error.message === "BROKER_PHONE_UNAVAILABLE" ? "BROKER_PHONE_UNAVAILABLE" : "TEMPLATE_DELIVERY_UNAVAILABLE";
    await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: safeCode, updatedAt: new Date() }).where(eq(schema.dutyPresenceConfirmations.id, record.id));
    return { ok: false, reason: "Não foi possível enviar o convite agora. Confira o canal de WhatsApp da empresa." };
  }
}

export type OwnDutyOccurrence = { assignmentId: string; scheduleId: string; mode: "online" | "presencial"; window: DutyWindow; joinedAt: Date | null };

/**
 * The broker's own occurrence of an assignment that can be confirmed now
 * (30 min before the start until 20 min after it, or after he was put on a plantão
 * that had already started). Scope: tenant + the broker himself.
 */
export async function resolveOwnDutyOccurrence(input: { tenantId: string; brokerId: string; assignmentId: string; now?: Date }): Promise<{ ok: true; occurrence: OwnDutyOccurrence } | { ok: false; reason: "not_found" | "outside_window" | "late" | "absent" }> {
  const now = input.now ?? new Date();
  const [row] = await getDatabase().select({
    id: schema.dutyRosterAssignments.id,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
    timezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    assignmentAttendanceMode: schema.dutyRosterAssignments.attendanceMode,
    joinedAt: schema.dutyRosterAssignments.createdAt,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
    .where(and(
      eq(schema.dutyRosterAssignments.id, input.assignmentId),
      eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
      eq(schema.dutyRosterAssignments.brokerId, input.brokerId),
      eq(schema.dutyRosterAssignments.status, "active"),
      eq(schema.unitDutySchedules.status, "active"),
    )).limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  const window = getWindow({ id: row.scheduleId, dayOfWeek: row.dayOfWeek, startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone, validFrom: row.validFrom, validUntil: row.validUntil }, now);
  if (!window) return { ok: false, reason: "outside_window" };
  const windowState = getSelfDutyConfirmationWindowState({ startsAt: window.startsAt, endsAt: window.endsAt, now, joinedAt: row.joinedAt });
  if (windowState === "late") return { ok: false, reason: "late" };
  if (windowState !== "available") return { ok: false, reason: "outside_window" };
  // An absence marked by the manager blocks before any photo is uploaded.
  const [absence] = await getDatabase().select({ id: schema.dutyPresenceConfirmations.id }).from(schema.dutyPresenceConfirmations).where(and(
    eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, row.id),
    eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate), eq(schema.dutyPresenceConfirmations.shiftStartsAt, window.startsAt),
    eq(schema.dutyPresenceConfirmations.shiftEndsAt, window.endsAt), eq(schema.dutyPresenceConfirmations.status, "absent"),
  )).limit(1);
  if (absence) return { ok: false, reason: "absent" };
  return { ok: true, occurrence: { assignmentId: row.id, scheduleId: row.scheduleId, mode: effectiveAttendanceMode(row.assignmentAttendanceMode, row.attendanceMode), window, joinedAt: row.joinedAt } };
}

/**
 * The broker answers the presence check in the app. Online: one tap confirms.
 * Presencial (decision of 2026-10-12): the photo of the place is saved and the
 * broker stays PAUSED until the director/manager validates it and releases him
 * (releaseDutyPresenceManually sets confirmedBy). An absence is never overwritten,
 * and a release already done is kept. The time window is revalidated here so a
 * request that crosses the tolerance while uploading a photo cannot confirm.
 */
export async function confirmOwnDutyPresence(input: { tenantId: string; brokerId: string; occurrence: OwnDutyOccurrence; photoStorageKey: string | null; now?: Date }): Promise<{ ok: true; confirmationId: string; awaitingRelease: boolean } | { ok: false; reason: "photo_required" | "outside_window" | "late" | "absent" }> {
  const now = input.now ?? new Date();
  const { occurrence } = input;
  const presencial = occurrence.mode === "presencial";
  const db = getDatabase();
  const occurrenceWhere = and(
    eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, occurrence.assignmentId),
    eq(schema.dutyPresenceConfirmations.dutyDate, occurrence.window.dutyDate), eq(schema.dutyPresenceConfirmations.shiftStartsAt, occurrence.window.startsAt),
    eq(schema.dutyPresenceConfirmations.shiftEndsAt, occurrence.window.endsAt),
  );
  const [existing] = await db.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status, confirmedBy: schema.dutyPresenceConfirmations.confirmedBy })
    .from(schema.dutyPresenceConfirmations).where(occurrenceWhere).limit(1);
  if (existing?.status === "absent") return { ok: false, reason: "absent" };
  if (existing?.status === "confirmed" && (!presencial || existing.confirmedBy)) return { ok: true, confirmationId: existing.id, awaitingRelease: false };
  const windowState = getSelfDutyConfirmationWindowState({ startsAt: occurrence.window.startsAt, endsAt: occurrence.window.endsAt, now, joinedAt: occurrence.joinedAt });
  if (windowState === "late") return { ok: false, reason: "late" };
  if (windowState !== "available") return { ok: false, reason: "outside_window" };
  if (presencial && !input.photoStorageKey) return { ok: false, reason: "photo_required" };
  const answer = presencial
    ? { status: "pending", confirmedAt: null, confirmedBy: null, photoStorageKey: input.photoStorageKey, photoTakenAt: now, updatedAt: now }
    : { status: "confirmed", confirmedAt: now, confirmedBy: null, updatedAt: now };
  const [row] = await db.insert(schema.dutyPresenceConfirmations).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    scheduleId: occurrence.scheduleId,
    assignmentId: occurrence.assignmentId,
    brokerId: input.brokerId,
    dutyDate: occurrence.window.dutyDate,
    shiftStartsAt: occurrence.window.startsAt,
    shiftEndsAt: occurrence.window.endsAt,
    notificationStatus: "sent",
    createdAt: now,
    ...answer,
  }).onConflictDoUpdate({
    target: [schema.dutyPresenceConfirmations.tenantId, schema.dutyPresenceConfirmations.assignmentId, schema.dutyPresenceConfirmations.dutyDate, schema.dutyPresenceConfirmations.shiftStartsAt, schema.dutyPresenceConfirmations.shiftEndsAt],
    set: answer,
    setWhere: presencial
      ? and(ne(schema.dutyPresenceConfirmations.status, "absent"), or(ne(schema.dutyPresenceConfirmations.status, "confirmed"), isNull(schema.dutyPresenceConfirmations.confirmedBy)))
      : ne(schema.dutyPresenceConfirmations.status, "absent"),
  }).returning({ id: schema.dutyPresenceConfirmations.id });
  if (!row) return { ok: false, reason: "absent" };
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: input.brokerId, entidade: "duty_presence_confirmation",
    entidadeId: row.id, acao: presencial ? "duty_presence_photo_sent" : "duty_presence_confirmed_app", createdAt: now,
  });
  return { ok: true, confirmationId: row.id, awaitingRelease: presencial };
}

/** Who validates an in-person photo: the tenant's directors and the managers of the plantão's branch (all managers when the plantão has no branch). */
export async function getDutyPhotoReviewers(tenantId: string, scheduleId: string) {
  const db = getDatabase();
  const [schedule] = await db.select({ branchId: schema.unitDutySchedules.branchId, name: schema.unitDutySchedules.name })
    .from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, tenantId))).limit(1);
  if (!schedule) return { scheduleName: null, reviewerIds: [] as string[] };
  const members = await db.select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.role, ["director", "manager"])));
  const reviewerIds = members
    .filter((member) => member.role === "director" || !schedule.branchId || !member.branchId || member.branchId === schedule.branchId)
    .map((member) => member.userId);
  return { scheduleName: schedule.name, reviewerIds: [...new Set(reviewerIds)] };
}
