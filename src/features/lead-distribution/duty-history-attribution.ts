export function matchesDutyHistoryAttribution(input: {
  dutyScheduleId: string | null;
  queueId: string | null;
  metadata: { scheduleId?: unknown; dutyScheduleId?: unknown; dutyDate?: unknown } | null;
  scheduleId: string;
  dutyDate: string;
  queueIds: readonly string[];
}) {
  if (input.dutyScheduleId) return input.dutyScheduleId === input.scheduleId;
  if (input.queueId && input.queueIds.includes(input.queueId)) return true;
  return input.metadata?.scheduleId === input.scheduleId && input.metadata.dutyDate === input.dutyDate;
}
