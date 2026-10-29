import "server-only";

import { and, asc, eq, gte, ne } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getSaoPauloDateKey } from "./dated-duty-roster";
import { manualQueueSettingKey, parseManualQueueValue } from "./duty-queue-order";
import { isDutyRotationEnabled } from "./duty-presence";
import { resolveDutyTurns, type DutyTurnRosterEntry, type DutyTurnState } from "./duty-turn-core";

export type { DutyTurnState } from "./duty-turn-core";

/**
 * The turn of one running plantão for its page (29/10): only this plantão's saved rotation and
 * today's offers, so the broker cards never depend on the heavier queue preview of every plantão.
 * Null when the rotation is off. Never throws: the cards just show without the turn.
 */
export async function getDutyTurnState(input: { tenantId: string; scheduleId: string; dutyDate: string; roster: DutyTurnRosterEntry[]; now?: Date }): Promise<DutyTurnState | null> {
  try {
    if (!(await isDutyRotationEnabled())) return null;
    const db = getDatabase();
    const now = input.now ?? new Date();
    const [setting, offers] = await Promise.all([
      db.select({ value: schema.systemSettings.value }).from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, manualQueueSettingKey(input.scheduleId, input.dutyDate))).limit(1),
      db.select({ brokerId: schema.leadOffers.brokerId, status: schema.leadOffers.status, offeredAt: schema.leadOffers.offeredAt, expiresAt: schema.leadOffers.expiresAt })
        .from(schema.leadOffers)
        .where(and(
          eq(schema.leadOffers.tenantId, input.tenantId),
          eq(schema.leadOffers.dutyScheduleId, input.scheduleId),
          gte(schema.leadOffers.offeredAt, new Date(`${getSaoPauloDateKey(now)}T00:00:00-03:00`)),
          ne(schema.leadOffers.status, "CANCELLED"),
        ))
        .orderBy(asc(schema.leadOffers.offeredAt)),
    ]);
    return resolveDutyTurns({ stored: parseManualQueueValue(setting[0]?.value), roster: input.roster, offers, now });
  } catch (error) {
    console.error("[plantao] duty_turn_failed", { scheduleId: input.scheduleId, error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 300) : "UnknownError" });
    return null;
  }
}
