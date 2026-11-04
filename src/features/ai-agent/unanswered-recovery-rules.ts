/**
 * Customer message the AI must still answer (case "Viva o Presente", 04/11/2026). Three messages in
 * eight seconds: the turn of the 2nd wrote its reply and dropped it because a newer message
 * existed, while the turn of the newer one had been skipped because the conversation was locked.
 * Nobody answered. These pure rules decide when a qualification conversation has a customer
 * message without any answer, and what text the recovery turn reads (the whole burst). No I/O.
 */

export type RecoveryMessage = {
  direction: string;
  body: string | null;
  mediaKind: string | null;
  provider: string | null;
  sentAt: Date;
  messageId: string | null;
  communicationChannelId: string | null;
  /** "failed" = the provider refused it: the customer never got that answer. */
  providerStatus?: string | null;
};

export type RecoveryConversation = { status: string; automationState: string | null };

/** Conversation states in which the AI is the one expected to answer. */
const AI_TURN_STATUSES = new Set(["WAITING_CUSTOMER", "AI_ACTIVE"]);
/** The official number: the AI qualification answers there (WAHA/OpenWA turns need their own session). */
const RECOVERABLE_PROVIDERS = new Set(["meta_cloud", "meta"]);
const MEDIA_PLACEHOLDER = /^\[(image|document|audio|video|sticker)\]$/i;

export type UnansweredInbound = {
  /** The newest customer message: the recovery turn answers as if it had just arrived. */
  latest: RecoveryMessage;
  /** Every unanswered customer text, in order, as one turn reads a burst. */
  body: string;
  messageKind: "text" | "image" | "document" | "audio" | "video" | "sticker";
};

function isAnswer(message: RecoveryMessage) {
  return (message.direction === "outbound" || message.direction === "outgoing") && message.providerStatus !== "failed";
}

function isCustomer(message: RecoveryMessage) {
  return message.direction === "incoming" || message.direction === "inbound";
}

/**
 * The customer messages after the last answer (AI or person), when the conversation is still the
 * AI's qualification turn. `minAgeMs` leaves the normal path (debounce + model) time to answer.
 */
export function findUnansweredInbound(input: {
  messages: readonly RecoveryMessage[];
  conversation: RecoveryConversation | null;
  qualificationStatus: string | null;
  now: Date;
  minAgeMs?: number;
  maxAgeMs?: number;
}): UnansweredInbound | null {
  const { conversation } = input;
  if (!conversation || !AI_TURN_STATUSES.has(conversation.status)) return null;
  if (conversation.automationState && conversation.automationState !== "AI_ACTIVE") return null;
  const status = input.qualificationStatus;
  if (status && status !== "pending" && status !== "qualifying") return null;

  const ordered = [...input.messages].sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());
  const lastAnswer = [...ordered].reverse().find(isAnswer);
  const pending = ordered.filter((message) => isCustomer(message) && (!lastAnswer || message.sentAt.getTime() > lastAnswer.sentAt.getTime()));
  const latest = pending.at(-1);
  if (!latest || !RECOVERABLE_PROVIDERS.has(latest.provider ?? "")) return null;
  // The provider refused twice already (closed window, blocked number): retrying only burns turns.
  const failedAfter = ordered.filter((message) => (message.direction === "outbound" || message.direction === "outgoing") && message.providerStatus === "failed" && message.sentAt.getTime() > latest.sentAt.getTime());
  if (failedAfter.length >= 2) return null;
  const age = input.now.getTime() - latest.sentAt.getTime();
  if (age < (input.minAgeMs ?? 0)) return null;
  if (input.maxAgeMs !== undefined && age > input.maxAgeMs) return null;

  const texts = pending.map((message) => message.body?.trim() ?? "").filter((text) => text && !MEDIA_PLACEHOLDER.test(text));
  const latestMedia = (latest.mediaKind ?? latest.body?.trim().match(MEDIA_PLACEHOLDER)?.[1] ?? "").toLowerCase();
  const messageKind = (["image", "document", "audio", "video", "sticker"].includes(latestMedia) && !texts.length ? latestMedia : "text") as UnansweredInbound["messageKind"];
  return { latest, body: texts.join("\n") || latest.body?.trim() || "", messageKind };
}
