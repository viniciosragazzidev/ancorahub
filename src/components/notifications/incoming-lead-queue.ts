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
): row is { tenant_id: string; recipient_user_id: string; type: "agent.lead_assigned"; lead_id: string } {
  return row.tenant_id === tenantId
    && row.recipient_user_id === userId
    && row.type === "agent.lead_assigned"
    && Boolean(row.lead_id);
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
