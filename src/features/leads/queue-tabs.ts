/**
 * Queue tabs of /leads: "Todas", one tab per queue with its count and
 * "Sem fila". Pure: the page counts, this decides what to show.
 */
export const NO_QUEUE_TAB = "sem-fila";

export type QueueTab = { value: string; label: string; count: number };

/**
 * Active queues always show (even empty, so the team finds them); an inactive
 * queue only while it still has leads. Busiest first, then by name.
 */
export function buildQueueTabs(input: {
  activeQueues: { id: string; name: string }[];
  counts: { queueId: string | null; queueName: string | null; total: number }[];
}): QueueTab[] {
  const byId = new Map<string, QueueTab>();
  for (const queue of input.activeQueues) byId.set(queue.id, { value: queue.id, label: queue.name, count: 0 });
  let withoutQueue = 0;
  let all = 0;
  for (const row of input.counts) {
    all += row.total;
    if (!row.queueId) { withoutQueue += row.total; continue; }
    const current = byId.get(row.queueId);
    if (current) current.count += row.total;
    else if (row.total > 0) byId.set(row.queueId, { value: row.queueId, label: row.queueName ?? "Fila removida", count: row.total });
  }
  const queues = [...byId.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  return [
    { value: "", label: "Todas", count: all },
    ...queues,
    ...(withoutQueue > 0 ? [{ value: NO_QUEUE_TAB, label: "Sem fila", count: withoutQueue }] : []),
  ];
}

/** The ?fila= value as a filter: a queue id, "sem-fila", or none. */
export function readQueueTab(value: string | null | undefined) {
  const tab = value?.trim() ?? "";
  if (!tab) return null;
  if (tab === NO_QUEUE_TAB) return { kind: "none" as const };
  return /^[\w-]{1,64}$/.test(tab) ? { kind: "queue" as const, queueId: tab } : null;
}
