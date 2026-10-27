"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import { findRunningDutySchedule } from "./duty-presence-domain";
import { reconcileManualQueueOrder } from "./duty-queue-order";
import { tryDistributionPickLock } from "./distribution-pick-lock";

const inputSchema = z.object({
  scheduleId: z.string().uuid(),
  dutyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brokerIds: z.array(z.string().uuid()).max(200),
}).strict();

function manualQueueKey(scheduleId: string, dutyDate: string) {
  return `manual-queue:${scheduleId}:${dutyDate}`;
}

async function resolveLiveOccurrence(scheduleId: string, dutyDate: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas o diretor pode ordenar a fila do plantão.");
  const now = new Date();
  const profile = await getDutyScheduleProfile(context, scheduleId);
  const running = findRunningDutySchedule([profile.schedule], now);
  if (!running || running.window.dutyDate !== dutyDate) throw new Error("A ocorrência deste plantão não está ativa.");
  return { context, db: getDatabase(), profile, now };
}

export async function saveDutyManualQueueAction(rawInput: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "A ordem enviada é inválida." };
  try {
    const { scheduleId, dutyDate, brokerIds } = parsed.data;
    const { context, db, profile, now } = await resolveLiveOccurrence(scheduleId, dutyDate);
    const rosterIds = profile.roster.map((entry) => entry.brokerId);
    if (brokerIds.some((brokerId) => !rosterIds.includes(brokerId))) return { ok: false, reason: "A escala mudou. Atualize a página e tente de novo." };
    const order = reconcileManualQueueOrder(brokerIds, rosterIds);
    const key = manualQueueKey(scheduleId, dutyDate);
    const saved = await db.transaction(async (tx) => {
      if (!await tryDistributionPickLock(tx, context.tenantId)) return false;
      await tx.insert(schema.systemSettings).values({ key, value: JSON.stringify(order), updatedAt: now }).onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value: JSON.stringify(order), updatedAt: now },
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "unit_duty_schedule",
        entidadeId: scheduleId,
        acao: "duty_roster.manual_queue_reordered",
        createdAt: now,
      });
      return true;
    });
    if (!saved) return { ok: false, reason: "A distribuição está escolhendo um corretor. Tente novamente em instantes." };
    revalidatePath("/leads/distribuicao");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível salvar a fila." };
  }
}

export async function resetDutyManualQueueAction(rawInput: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = z.object({ scheduleId: z.string().uuid(), dutyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict().safeParse(rawInput);
  if (!parsed.success) return { ok: false, reason: "A ocorrência enviada é inválida." };
  try {
    const { scheduleId, dutyDate } = parsed.data;
    const { context, db, now } = await resolveLiveOccurrence(scheduleId, dutyDate);
    const key = manualQueueKey(scheduleId, dutyDate);
    const cleared = await db.transaction(async (tx) => {
      if (!await tryDistributionPickLock(tx, context.tenantId)) return false;
      await tx.delete(schema.systemSettings).where(eq(schema.systemSettings.key, key));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "unit_duty_schedule",
        entidadeId: scheduleId,
        acao: "duty_roster.manual_queue_reset",
        createdAt: now,
      });
      return true;
    });
    if (!cleared) return { ok: false, reason: "A distribuição está escolhendo um corretor. Tente novamente em instantes." };
    revalidatePath("/leads/distribuicao");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível voltar ao automático." };
  }
}
