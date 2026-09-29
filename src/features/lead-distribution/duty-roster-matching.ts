export type DutyScheduleCredential = {
  id: string;
  webhookCredentialId: string | null;
};

export type QueueLinkedDutySchedule = DutyScheduleCredential & {
  queueId: string | null;
};

/**
 * Returns only currently-active schedules explicitly attached to this queue.
 * Schedules are linked either from the queue's configured IDs or from the
 * legacy schedule.queueId field. The schedule's unit does not narrow its roster.
 */
export function selectQueueLinkedDutySchedules<T extends QueueLinkedDutySchedule>(
  schedules: T[],
  queueId: string,
  linkedScheduleIds: string[],
) {
  const linkedIds = new Set(linkedScheduleIds);
  return schedules.filter((schedule) => linkedIds.has(schedule.id) || schedule.queueId === queueId);
}

export function canManuallyAssignLeadToBroker(input: {
  hasActiveQueueDuty: boolean;
  brokerId: string;
  brokerBranchId: string | null;
  leadBranchId: string | null;
  activeDutyBrokerIds: string[];
}) {
  if (input.hasActiveQueueDuty) return input.activeDutyBrokerIds.includes(input.brokerId);
  return input.brokerBranchId === input.leadBranchId;
}

/**
 * A plantão without a credential is the catch-all schedule for every origin.
 * A credential-specific plantão only accepts leads from that credential.
 */
export function selectMatchingDutyScheduleIds(
  schedules: DutyScheduleCredential[],
  leadWebhookCredentialId?: string | null,
) {
  return schedules
    .filter((schedule) =>
      schedule.webhookCredentialId === null
        ? true
        : Boolean(leadWebhookCredentialId && schedule.webhookCredentialId === leadWebhookCredentialId),
    )
    .map((schedule) => schedule.id);
}
