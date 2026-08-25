export interface IncomingLead {
  notificationId: string;
  leadId: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface IncomingLeadQueueState {
  queue: IncomingLead[];
  seenIds: Set<string>;
}

export function isAssignedLeadNotification(
  row: { tenant_id?: string; recipient_user_id?: string; type?: string; lead_id?: string | null },
  tenantId: string,
  userId: string,
): row is { tenant_id: string; recipient_user_id: string; type: string; lead_id: string } {
  if (row.tenant_id !== tenantId || row.recipient_user_id !== userId || !row.lead_id) return false;
  const type = row.type ?? "";
  return type === "agent.lead_assigned" || type === "lead_arrived" || type === "lead_reassigned" || type.startsWith("lead");
}

export function createIncomingLeadQueueState(): IncomingLeadQueueState {
  return { queue: [], seenIds: new Set() };
}

export function enqueueIncomingLead(
  state: IncomingLeadQueueState,
  item: IncomingLead,
  maxQueue = 3,
): IncomingLeadQueueState {
  if (!item.notificationId || state.seenIds.has(item.notificationId)) return state;

  // Evita duplicatas do mesmo lead na fila caso receba via WS e polling simultâneos
  const existingLead = state.queue.some((q) => q.leadId === item.leadId);
  if (existingLead) {
    const seenIds = new Set(state.seenIds);
    seenIds.add(item.notificationId);
    return { queue: state.queue, seenIds };
  }

  const seenIds = new Set(state.seenIds);
  seenIds.add(item.notificationId);
  return {
    queue: [item, ...state.queue].slice(0, Math.max(1, maxQueue)),
    seenIds,
  };
}

export function resolveIncomingLead(
  state: IncomingLeadQueueState,
  notificationId: string,
): IncomingLeadQueueState {
  return {
    queue: state.queue.filter((item) => item.notificationId !== notificationId),
    seenIds: state.seenIds,
  };
}
