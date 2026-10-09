import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, lt, ne, or } from "drizzle-orm";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { findDutyOccurrenceConfirmation, formatDutyStartHour, getRelevantDutyWindow, isConfirmationForActiveOccurrence, isDutyBrokerEligible, isDutyWindowActive, type DutyWindow } from "./duty-presence-domain";
import { getPublishedDutyScheduleIds, getSaoPauloDateKey, selectEffectiveDutyAssignments } from "./dated-duty-roster";

type PresenceAssignment = { id: string; scheduleId: string; brokerId: string; dayOfWeek: number; startsAt: string; endsAt: string; validFrom: Date; validUntil: Date | null };
type PresenceSchedule = { id: string; dayOfWeek: number; startsAt: string; endsAt: string; timezone: string; validFrom: Date; validUntil: Date | null; attendanceMode?: string };

export async function isDutyPresenceConfirmationEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION)) === "true";
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
  if (!input.assignments.length) return { eligibleAssignmentIds: new Set<string>(), confirmedPresenceAssignmentIds: new Set<string>() };
  const presenceRequired = await isDutyPresenceConfirmationEnabled();

  const scheduleById = new Map(input.schedules.map((schedule) => [schedule.id, schedule]));
  const occurrences = input.assignments.flatMap((assignment) => {
    const schedule = scheduleById.get(assignment.scheduleId);
    if (!schedule) return [];
    const window = getWindow({ ...schedule, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt, endsAt: assignment.endsAt, validFrom: assignment.validFrom, validUntil: assignment.validUntil }, input.now);
    return window && isDutyWindowActive(window, input.now) ? [{ assignment, schedule, window }] : [];
  });
  if (!occurrences.length) return { eligibleAssignmentIds: new Set<string>(), confirmedPresenceAssignmentIds: new Set<string>() };

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
    })
    .from(schema.dutyPresenceConfirmations)
    .where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
      gt(schema.dutyPresenceConfirmations.shiftEndsAt, input.now),
      inArray(schema.dutyPresenceConfirmations.assignmentId, occurrences.map(({ assignment }) => assignment.id)),
    ));
  const eligible = occurrences.filter(({ assignment, schedule, window }) => {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: confirmationRows, assignment, window, now: input.now });
      return isDutyBrokerEligible({ attendanceMode: schedule.attendanceMode ?? "online", presenceRequired, status: confirmation?.status ?? null, confirmedBy: confirmation?.confirmedBy ?? null })
        && (!(presenceRequired || schedule.attendanceMode === "presencial") || isConfirmationForActiveOccurrence({ confirmation, assignment, window, now: input.now }));
    });
  return {
    eligibleAssignmentIds: new Set(eligible.map(({ assignment }) => assignment.id)),
    confirmedPresenceAssignmentIds: new Set(eligible.flatMap(({ assignment, window }) => {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: confirmationRows, assignment, window, now: input.now });
      return confirmation?.status === "confirmed" && confirmation.confirmedBy ? [assignment.id] : [];
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
  for (const assignment of assignments) {
    const schedule = scheduleById.get(assignment.scheduleId);
    if (!schedule || schedule.tenantId !== assignment.tenantId || schedule.attendanceMode === "presencial") continue;
    const window = getWindow({
      id: schedule.id, dayOfWeek: assignment.dayOfWeek, startsAt: assignment.startsAt,
      endsAt: assignment.endsAt, timezone: schedule.timezone,
      validFrom: assignment.validFrom, validUntil: assignment.validUntil,
    }, now);
    // Do not create reminders outside the 30-minute pre-shift window or active shift.
    if (!window) continue;
    const reminderOpensAt = new Date(window.startsAt.getTime() - 30 * 60_000);
    if (now < reminderOpensAt || now >= window.endsAt) continue;
    const shiftDay = getSaoPauloDateKey(window.startsAt);
    const group = sameBrokerRows.get(`${assignment.tenantId}|${assignment.scheduleId}|${assignment.brokerId}`) ?? [assignment];
    if (!selectEffectiveDutyAssignments(group, shiftDay, await publishedFor(assignment.tenantId, shiftDay)).some((row) => row.id === assignment.id)) continue;
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

/**
 * A director/manager releases a broker for the current (or next) occurrence of
 * their shift without the broker clicking the confirmation — e.g. an
 * in-person plantão checked on site. The broker is then eligible for offers
 * exactly as after their own click; who released it is kept.
 */
export async function releaseDutyPresenceManually(input: { tenantId: string; assignmentId: string; releasedBy: string }, now = new Date()): Promise<{ ok: true } | { ok: false; reason: string }> {
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
  const released = await db.transaction(async (tx) => {
    await tx.insert(schema.dutyPresenceConfirmations).values({
      id: randomUUID(), tenantId: input.tenantId, scheduleId: assignment.scheduleId, assignmentId: assignment.id, brokerId: assignment.brokerId,
      dutyDate: window.dutyDate, shiftStartsAt: window.startsAt, shiftEndsAt: window.endsAt,
      status: "pending", notificationStatus: "pending", createdAt: now, updatedAt: now,
    }).onConflictDoNothing();
    const changed = await tx.update(schema.dutyPresenceConfirmations)
      .set({ status: "confirmed", confirmedAt: now, confirmedBy: input.releasedBy, updatedAt: now })
      .where(and(occurrence, ne(schema.dutyPresenceConfirmations.status, "absent"), or(ne(schema.dutyPresenceConfirmations.status, "confirmed"), isNull(schema.dutyPresenceConfirmations.confirmedBy))))
      .returning({ id: schema.dutyPresenceConfirmations.id });
    if (!changed.length) return false;
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.releasedBy, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: "duty_presence.released_manually", createdAt: now });
    return true;
  });
  if (!released) return { ok: false, reason: "Corretor já liberado ou com falta registrada." };
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
      variables: [assignment.brokerName, formatDutyStartHour(window.startsAt, assignment.scheduleTimezone), record.id],
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
