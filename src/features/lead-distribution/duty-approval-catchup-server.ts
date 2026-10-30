import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, eq, gte, ne } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { tryDistributionPickLock } from "./distribution-pick-lock";
import { manualQueueSettingKey, parseManualQueueValue } from "./duty-queue-order";
import { parseTurnCredit, placeAfterApprovalDelay, turnCreditSettingKey } from "./duty-approval-catchup";

/**
 * The photo of a presencial broker was approved (30/10): place them in the rotation where they would
 * be had the approval been instant, and keep the turns they lost as credit. Only when the plantão's
 * turn is already running (with no saved turn yet, the order of arrival uses the photo time). Under
 * the pick lock, like every change of the turn. Never throws.
 */
export async function applyApprovalDelayCatchup(input: { tenantId: string; scheduleId: string; dutyDate: string; brokerId: string; photoTakenAt: Date; releasedBy: string; now?: Date }) {
  try {
    const db = getDatabase();
    const now = input.now ?? new Date();
    return await db.transaction(async (tx) => {
      if (!(await tryDistributionPickLock(tx, input.tenantId))) return { applied: false as const, reason: "lock_busy" };
      const queueKey = manualQueueSettingKey(input.scheduleId, input.dutyDate);
      const creditKey = turnCreditSettingKey(input.scheduleId, input.dutyDate);
      const [[queueRow], [creditRow], [offers]] = await Promise.all([
        tx.select({ value: schema.systemSettings.value }).from(schema.systemSettings).where(eq(schema.systemSettings.key, queueKey)).limit(1),
        tx.select({ value: schema.systemSettings.value }).from(schema.systemSettings).where(eq(schema.systemSettings.key, creditKey)).limit(1),
        tx.select({ total: count() }).from(schema.leadOffers).where(and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          eq(schema.leadOffers.dutyScheduleId, input.scheduleId),
          gte(schema.leadOffers.offeredAt, input.photoTakenAt),
          ne(schema.leadOffers.status, "CANCELLED"),
        )),
      ]);
      const stored = parseManualQueueValue(queueRow?.value);
      if (!stored?.length || stored.includes(input.brokerId)) return { applied: false as const, reason: "no_running_turn" };
      const placed = placeAfterApprovalDelay({ stored, brokerId: input.brokerId, offersSincePhoto: Number(offers?.total ?? 0) });
      await tx.insert(schema.systemSettings).values({ key: queueKey, value: JSON.stringify(placed.order), updatedAt: now }).onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value: JSON.stringify(placed.order), updatedAt: now },
      });
      if (placed.credit > 0) {
        const credit = { ...parseTurnCredit(creditRow?.value), [input.brokerId]: placed.credit };
        await tx.insert(schema.systemSettings).values({ key: creditKey, value: JSON.stringify(credit), updatedAt: now }).onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: { value: JSON.stringify(credit), updatedAt: now },
        });
      }
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: input.releasedBy,
        entidade: "unit_duty_schedule",
        entidadeId: input.scheduleId,
        acao: `duty_roster.approval_delay_catchup:${input.brokerId}:${placed.missedTurns}`,
        createdAt: now,
      });
      return { applied: true as const, position: placed.order.indexOf(input.brokerId) + 1, credit: placed.credit };
    });
  } catch (error) {
    console.error("[plantao] approval_catchup_failed", { scheduleId: input.scheduleId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { applied: false as const, reason: "failed" };
  }
}
