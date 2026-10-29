import "server-only";

import { randomUUID } from "node:crypto";
import { and, countDistinct, eq, gte, inArray, isNull, or } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getSaoPauloDateKey } from "./dated-duty-roster";
import { isDutyRotationEnabled } from "./duty-presence";
import { DUTY_SKIP_PAUSE_LIMIT, SKIP_OFFER_STATUSES, skipReachesPauseLimit } from "./duty-rotation";

/** Start of the São Paulo day of `date` (UTC-3 all year). */
function saoPauloDayStart(date: Date) {
  return new Date(`${getSaoPauloDateKey(date)}T00:00:00-03:00`);
}

/**
 * After an offer of a plantão expires or is declined (a skip, 29/10): on the 3rd skip of the day in
 * that plantão (and every 3 after a resume) the broker's escala of today is paused and the supervisor
 * is warned. Only the supervisor resumes. Never throws: a failure here must not hold the offer flow.
 */
export async function applyDutySkipPolicy(input: { tenantId: string; brokerId: string; dutyScheduleId: string | null; at?: Date }) {
  if (!input.dutyScheduleId) return { paused: false };
  try {
    if (!(await isDutyRotationEnabled())) return { paused: false };
    const db = getDatabase();
    const now = input.at ?? new Date();
    const [row] = await db.select({ skips: countDistinct(schema.leadOffers.leadId) })
      .from(schema.leadOffers)
      .where(and(
        eq(schema.leadOffers.tenantId, input.tenantId),
        eq(schema.leadOffers.brokerId, input.brokerId),
        eq(schema.leadOffers.dutyScheduleId, input.dutyScheduleId),
        inArray(schema.leadOffers.status, [...SKIP_OFFER_STATUSES]),
        gte(schema.leadOffers.offeredAt, saoPauloDayStart(now)),
      ));
    const skips = Number(row?.skips ?? 0);
    if (!skipReachesPauseLimit(skips)) return { paused: false, skips };

    const today = getSaoPauloDateKey(now);
    const weekday = new Date(`${today}T12:00:00-03:00`).getUTCDay();
    const systemUserId = await resolveSystemUserId(input.tenantId);
    // Every row of today (weekly and published), all with the same pausedAt: resuming one resumes all.
    const paused = await db.update(schema.dutyRosterAssignments)
      .set({ pausedAt: now, pausedBy: systemUserId, updatedAt: now })
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
        eq(schema.dutyRosterAssignments.brokerId, input.brokerId),
        eq(schema.dutyRosterAssignments.scheduleId, input.dutyScheduleId),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.dutyRosterAssignments.dayOfWeek, weekday),
        isNull(schema.dutyRosterAssignments.pausedAt),
        or(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dutyDate, today)),
      ))
      .returning({ id: schema.dutyRosterAssignments.id });
    if (!paused.length) return { paused: false, skips };

    await db.insert(schema.auditLogs).values(paused.map((assignment) => ({
      id: randomUUID(), userId: systemUserId, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: "duty_roster.paused_by_skips", createdAt: now,
    })));

    const [[broker], [schedule]] = await Promise.all([
      db.select({ name: schema.user.name, supervisorId: schema.tenantMemberships.supervisorId, branchId: schema.tenantMemberships.branchId })
        .from(schema.user)
        .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, input.tenantId)))
        .where(eq(schema.user.id, input.brokerId))
        .limit(1),
      db.select({ name: schema.unitDutySchedules.name }).from(schema.unitDutySchedules)
        .where(and(eq(schema.unitDutySchedules.id, input.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, input.tenantId)))
        .limit(1),
    ]);
    // The broker's supervisor; without one, the managers of the broker's unit.
    const recipients = broker?.supervisorId
      ? [broker.supervisorId]
      : broker?.branchId
        ? (await db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(
          eq(schema.tenantMemberships.tenantId, input.tenantId),
          eq(schema.tenantMemberships.branchId, broker.branchId),
          eq(schema.tenantMemberships.role, "manager"),
          eq(schema.tenantMemberships.status, "active"),
        ))).map((member) => member.id)
        : [];
    const brokerName = broker?.name ?? "Corretor";
    const scheduleName = schedule?.name ?? "plantão";
    const key = `duty-skip-pause:${input.brokerId}:${input.dutyScheduleId}:${today}:${skips}`;
    await Promise.allSettled([
      ...recipients.map((recipientUserId) => publishNotification({
        capability: "duty_skip_pause",
        tenantId: input.tenantId,
        recipientUserId,
        type: "duty_skip_pause",
        title: `${brokerName} está em pausa no ${scheduleName}`,
        message: `${brokerName} deixou ${skips} leads sem atender hoje no ${scheduleName} e entrou em pausa automática. Converse sobre os atendimentos e despause na fila do plantão quando puder voltar a receber.`,
        pushTitle: "Pausa automática por pulos",
        pushBody: `${brokerName}: ${skips} leads sem atender no ${scheduleName}.`,
        url: "/leads/distribuicao/plantao",
        tag: `duty-skip-pause-${input.brokerId}`,
        idempotencyKey: `${key}:${recipientUserId}`,
      })),
      publishNotification({
        capability: "duty_skip_pause",
        tenantId: input.tenantId,
        recipientUserId: input.brokerId,
        type: "duty_skip_pause",
        title: `Pausa automática no ${scheduleName}`,
        message: `Você deixou ${DUTY_SKIP_PAUSE_LIMIT} leads passarem sem atender hoje. Enquanto estiver pausado, não recebe leads deste plantão. Fale com seu supervisor para voltar.`,
        pushTitle: "Pausa no plantão",
        pushBody: `${DUTY_SKIP_PAUSE_LIMIT} leads sem atender no ${scheduleName}. Fale com seu supervisor.`,
        url: "/plantoes/agora",
        tag: `duty-skip-pause-${input.brokerId}`,
        idempotencyKey: `${key}:broker`,
      }),
    ]);
    return { paused: true, skips };
  } catch (error) {
    console.error("[duty-skips] policy failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return { paused: false };
  }
}
