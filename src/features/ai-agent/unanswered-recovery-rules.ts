/**
 * Customer message the AI must still answer (case "Viva o Presente", 04/11/2026). Three messages in
 * eight seconds: the turn of the 2nd wrote its reply and dropped it because a newer message
 * existed, while the turn of the newer one had been skipped because the conversation was locked.
 * Nobody answered. These pure rules decide when a qualification conversation has a customer
 * message without any answer, and what text the recovery turn reads (the whole burst). No I/O.
 */

import { isAutomatedInboundMessage } from "./automated-inbound";

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

export const RECOVERY_TURN_WORST_CASE_MS = 40_000;

export function hasRecoveryTurnBudget(nowMs: number, deadlineAtMs: number, worstCaseMs = RECOVERY_TURN_WORST_CASE_MS) {
  return deadlineAtMs - nowMs >= worstCaseMs;
}

/** Keep recovery younger than the tenant's timeout, with one minute of separation and a 30-minute cap. */
export function recoveryMaxAgeMs(timeoutMinutes: number | null | undefined) {
  const configured = typeof timeoutMinutes === "number" && Number.isFinite(timeoutMinutes)
    ? Math.max(1, Math.floor(timeoutMinutes))
    : 15;
  return Math.max(0, Math.min(30, configured - 1)) * 60_000;
}

/** Conversation states in which the AI is the one expected to answer. */
const AI_TURN_STATUSES = new Set(["WAITING_CUSTOMER", "AI_ACTIVE"]);
/** The official number: the AI qualification answers there (WAHA/OpenWA turns need their own session). */
const RECOVERABLE_PROVIDERS = new Set(["meta_cloud", "meta"]);
const MEDIA_PLACEHOLDER = /^\[(image|document|audio|video|sticker)\]$/i;

export function isUnansweredRecoveryStateEligible(input: {
  conversation: RecoveryConversation | null;
  qualificationStatus: string | null;
  distributionStatus?: string | null;
}) {
  if (!input.conversation || !AI_TURN_STATUSES.has(input.conversation.status)) return false;
  if (input.conversation.automationState && input.conversation.automationState !== "AI_ACTIVE") return false;
  if (input.qualificationStatus !== "pending" && input.qualificationStatus !== "qualifying") return false;
  if (input.distributionStatus === "manual_hold") return false;
  return true;
}

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
  distributionStatus?: string | null;
  timeoutMinutes?: number | null;
  now: Date;
  minAgeMs?: number;
  maxAgeMs?: number;
}): UnansweredInbound | null {
  const { conversation } = input;
  if (!isUnansweredRecoveryStateEligible({
    conversation,
    qualificationStatus: input.qualificationStatus,
    distributionStatus: input.distributionStatus,
  })) return null;

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
  const maxAgeMs = input.maxAgeMs ?? recoveryMaxAgeMs(input.timeoutMinutes);
  if (age > maxAgeMs) return null;

  const texts = pending.map((message) => message.body?.trim() ?? "")
    .filter((text) => text && !MEDIA_PLACEHOLDER.test(text) && !isAutomatedInboundMessage(text));
  const latestMedia = (latest.mediaKind ?? latest.body?.trim().match(MEDIA_PLACEHOLDER)?.[1] ?? "").toLowerCase();
  const messageKind = (["image", "document", "audio", "video", "sticker"].includes(latestMedia) && !texts.length ? latestMedia : "text") as UnansweredInbound["messageKind"];
  const hasLatestMedia = ["image", "document", "audio", "video", "sticker"].includes(latestMedia);
  if (!texts.length && !hasLatestMedia) return null;
  return { latest, body: texts.join("\n") || latest.body?.trim() || "", messageKind };
}
