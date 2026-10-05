export type DutyLeadQueueOption = { id: string; name: string };

export function resolveDutyLeadQueueId(queues: readonly DutyLeadQueueOption[], requestedId?: string | null) {
  if (queues.length <= 1) return null;
  return queues.find((queue) => queue.id === requestedId)?.id ?? queues[0]?.id ?? null;
}

export function getDutyLeadQueueTabs<T extends DutyLeadQueueOption, L extends { queueId: string | null }>(
  queues: readonly T[],
  waitingLeads: readonly L[],
) {
  if (queues.length <= 1) return [];
  return queues.map((queue) => ({
    ...queue,
    count: waitingLeads.filter((lead) => lead.queueId === queue.id).length,
  }));
}

/** Waiting leads are scoped to a queue tab; distributed leads stay aggregated. */
export function selectDutyLeadsForQueue<L extends { queueId: string | null }>(
  leads: readonly L[],
  selectedQueueId: string | null,
  distributed: boolean,
) {
  if (distributed || !selectedQueueId) return [...leads];
  return leads.filter((lead) => lead.queueId === selectedQueueId);
}
