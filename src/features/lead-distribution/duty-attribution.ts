export type DutyReceipt = {
  brokerId: string | null;
  leadId: string;
  dutyScheduleId: string | null;
  receivedAt: Date | null;
};

/** Explicit attribution wins; a null id follows the pre-attribution day/occurrence fallback. */
export function belongsToDutySchedule(dutyScheduleId: string | null, scheduleId: string | undefined) {
  return dutyScheduleId === null || dutyScheduleId === scheduleId;
}

export function countReceivedInDuty(input: {
  brokerId: string;
  scheduleId: string | undefined;
  since: Date;
  receipts: readonly DutyReceipt[];
}) {
  return new Set(input.receipts.flatMap((receipt) => receipt.brokerId === input.brokerId
    && receipt.receivedAt !== null
    && receipt.receivedAt >= input.since
    && belongsToDutySchedule(receipt.dutyScheduleId, input.scheduleId)
    ? [receipt.leadId]
    : [])).size;
}

export function countDutyLeadsByBroker(
  rows: readonly { brokerId: string | null; leadId: string; dutyScheduleId: string | null }[],
  scheduleId: string,
) {
  const leadsByBroker = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.brokerId || !belongsToDutySchedule(row.dutyScheduleId, scheduleId)) continue;
    const leadIds = leadsByBroker.get(row.brokerId) ?? new Set<string>();
    leadIds.add(row.leadId);
    leadsByBroker.set(row.brokerId, leadIds);
  }
  return new Map([...leadsByBroker].map(([brokerId, leadIds]) => [brokerId, leadIds.size]));
}
