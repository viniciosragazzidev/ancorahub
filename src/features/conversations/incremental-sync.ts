export type ConversationIncrementalMessage = {
  id: string;
  sentAt: string;
};
export type IncrementalProviderFailure = { code: string; title: string; message: string } | null;
export type ConversationAiStatusPatch = {
  id: string;
  status: string;
  assignedUserId: string | null;
} | null;

export type ConversationIncrementalPatch<TMessage extends ConversationIncrementalMessage> = {
  id: string;
  latestMessage?: { body: string; direction: string; sentAt: string } | null;
  /** Number of messages newer than the request cursor; the client adds it to its snapshot. */
  messageCountDelta?: number;
  /** True only when an incoming message arrived after the request cursor. */
  hasIncomingDelta?: boolean;
  aiConversationStatus?: ConversationAiStatusPatch;
  replyBlockedMessage?: string | null;
  messages?: TMessage[];
  messageStatuses?: Array<{
    id: string;
    providerStatus: string | null;
    providerFailure?: IncrementalProviderFailure;
  }>;
};

type ConversationWithIncrementalState<TMessage extends ConversationIncrementalMessage> = {
  id: string;
  latestMessage: { body: string; direction: string; sentAt: string } | null;
  messageCount?: number;
  hasIncoming?: boolean;
  aiConversation?: {
    id: string;
    status: string;
    assignedUserId: string | null;
    [key: string]: unknown;
  } | null;
  replyBlockedMessage?: string | null;
  messages: TMessage[];
};

/** Merge only server-scoped patches. It never adds a conversation the initial server list did not authorize. */
export function mergeConversationIncrementalUpdates<
  TMessage extends ConversationIncrementalMessage & { providerStatus?: string | null },
  TConversation extends ConversationWithIncrementalState<TMessage>,
>(
  current: readonly TConversation[],
  updates: readonly ConversationIncrementalPatch<TMessage>[],
  options: { openConversationId?: string | null; messageLimit?: number } = {},
) {
  const byId = new Map(current.map((conversation) => [conversation.id, conversation]));
  const missingIds: string[] = [];

  for (const update of updates) {
    const conversation = byId.get(update.id);
    if (!conversation) {
      missingIds.push(update.id);
      continue;
    }

    const isOpen = update.id === options.openConversationId;
    const messagesById = new Map(conversation.messages.map((message) => [message.id, message]));
    if (isOpen) {
      for (const message of update.messages ?? []) messagesById.set(message.id, message);
      for (const status of update.messageStatuses ?? []) {
        const message = messagesById.get(status.id);
        if (message) messagesById.set(status.id, {
          ...message,
          providerStatus: status.providerStatus,
          ...(status.providerFailure !== undefined ? { providerFailure: status.providerFailure } : {}),
        });
      }
    }
    const mergedMessages = isOpen
      ? [...messagesById.values()]
        .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt) || left.id.localeCompare(right.id))
        .slice(-(options.messageLimit ?? 300))
      : conversation.messages;

    byId.set(update.id, {
      ...conversation,
      ...(update.latestMessage !== undefined ? { latestMessage: update.latestMessage } : {}),
      ...(update.messageCountDelta !== undefined
        ? { messageCount: (conversation.messageCount ?? conversation.messages.length) + update.messageCountDelta }
        : {}),
      ...(update.hasIncomingDelta ? { hasIncoming: true } : {}),
      ...(update.aiConversationStatus !== undefined
        ? {
            aiConversation: update.aiConversationStatus
              ? {
                  ...conversation.aiConversation,
                  ...update.aiConversationStatus,
                  aiModel: conversation.aiConversation?.aiModel ?? null,
                  transferReason: conversation.aiConversation?.transferReason ?? null,
                  qualificationSummary: conversation.aiConversation?.qualificationSummary ?? null,
                }
              : null,
          }
        : {}),
      ...(update.replyBlockedMessage !== undefined ? { replyBlockedMessage: update.replyBlockedMessage } : {}),
      messages: mergedMessages,
    });
  }

  const conversations = [...byId.values()].sort((left, right) => {
    const leftAt = left.latestMessage ? Date.parse(left.latestMessage.sentAt) : 0;
    const rightAt = right.latestMessage ? Date.parse(right.latestMessage.sentAt) : 0;
    return rightAt - leftAt || left.id.localeCompare(right.id);
  });

  return { conversations, missingIds };
}

export const CONVERSATION_OFFLINE_REFRESH_AFTER_MS = 2 * 60_000;
export const CONVERSATION_STALE_REFRESH_AFTER_MS = 10 * 60_000;

/** Offline pages reconcile on a short interval; a healthy but silent socket gets a long safety refresh. */
export function shouldRefreshConversationServer(input: {
  realtimeLive: boolean;
  lastFullRefreshAt: number;
  lastSignalAt: number;
  now: number;
}) {
  if (!input.realtimeLive) {
    return input.now - input.lastFullRefreshAt >= CONVERSATION_OFFLINE_REFRESH_AFTER_MS;
  }
  return input.now - Math.max(input.lastSignalAt, input.lastFullRefreshAt) >= CONVERSATION_STALE_REFRESH_AFTER_MS;
}

export function isValidConversationCursor(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  if (typeof cursor.sentAt !== "string" || typeof cursor.id !== "string" || cursor.id.length > 128) return false;
  const parsed = Date.parse(cursor.sentAt);
  return Number.isFinite(parsed) && parsed <= now + 30_000 && now - parsed <= 2 * 60_000;
}

export function parseSyntheticConversationPhone(id: string): string | null {
  if (!id.startsWith("unassigned-")) return null;
  const phone = id.slice("unassigned-".length).replace(/\D/g, "");
  return phone.length >= 8 && phone.length <= 20 ? phone : null;
}
