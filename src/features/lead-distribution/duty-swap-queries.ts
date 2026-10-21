import "server-only";

import { and, desc, eq, inArray, or } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { swapNoticeFor, type SwapNotice, type SwapRecord } from "./duty-swap";

/** Swap records touching these slots, newest first, with the names the notice shows. */
export async function loadDutySwapRecords(tenantId: string, assignmentIds: readonly string[]): Promise<SwapRecord[]> {
  if (!assignmentIds.length) return [];
  const db = getDatabase();
  const ids = [...new Set(assignmentIds)];
  const rows = await db.select().from(schema.dutyRosterSwaps)
    .where(and(
      eq(schema.dutyRosterSwaps.tenantId, tenantId),
      or(inArray(schema.dutyRosterSwaps.assignmentAId, ids), inArray(schema.dutyRosterSwaps.assignmentBId, ids)),
    ))
    .orderBy(desc(schema.dutyRosterSwaps.swappedAt))
    .limit(500);
  if (!rows.length) return [];
  const userIds = [...new Set(rows.flatMap((row) => [row.brokerAId, row.brokerBId]))];
  const scheduleIds = [...new Set(rows.flatMap((row) => [row.scheduleAId, row.scheduleBId]))];
  const [users, schedules] = await Promise.all([
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, userIds)),
    db.select({ id: schema.unitDutySchedules.id, name: schema.unitDutySchedules.name }).from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), inArray(schema.unitDutySchedules.id, scheduleIds))),
  ]);
  const userName = new Map(users.map((row) => [row.id, row.name]));
  const scheduleName = new Map(schedules.map((row) => [row.id, row.name]));
  return rows.map((row) => ({
    id: row.id,
    assignmentAId: row.assignmentAId,
    assignmentBId: row.assignmentBId,
    brokerAId: row.brokerAId,
    brokerBId: row.brokerBId,
    brokerAName: userName.get(row.brokerAId) ?? "Corretor",
    brokerBName: userName.get(row.brokerBId) ?? "Corretor",
    scheduleAName: scheduleName.get(row.scheduleAId) ?? "Plantão",
    scheduleBName: scheduleName.get(row.scheduleBId) ?? "Plantão",
    dutyDateA: String(row.dutyDateA),
    dutyDateB: String(row.dutyDateB),
    whatsappAStatus: row.whatsappAStatus,
    whatsappBStatus: row.whatsappBStatus,
    swappedAt: row.swappedAt,
  }));
}

/**
 * "Troca feita" of each roster slot (assignment id → notice). Never breaks the page:
 * before the duty_roster_swaps migration is applied it just shows no swap.
 */
export async function getDutySwapNotices(tenantId: string, slots: ReadonlyArray<{ id: string; brokerId: string }>): Promise<Map<string, SwapNotice>> {
  const notices = new Map<string, SwapNotice>();
  try {
    const records = await loadDutySwapRecords(tenantId, slots.map((slot) => slot.id));
    for (const slot of slots) {
      for (const record of records) {
        const notice = swapNoticeFor(record, slot.id, slot.brokerId);
        if (notice) { notices.set(slot.id, notice); break; }
      }
    }
  } catch {
    // Table not there yet, or a read failure: the roster still renders.
  }
  return notices;
}
