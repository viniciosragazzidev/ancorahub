export const NEGOTIATION_LIMITS = {
  messageWindowDays: 7,
  activeExchangeDays: 3,
  exchangeHistoryDays: 5,
  staleReplyHours: 4,
} as const;

export type NegotiationLevel = "closing" | "advanced" | "in_conversation" | "cooling" | "no_crm_conversation";
export type NegotiationReplyOwedBy = "broker" | "customer" | "none";

export type NegotiationSignals = {
  status: string;
  stageEnteredAt: Date | string | null;
  assignedAt: Date | string | null;
  now: Date;
  lastCustomerMessageAt: Date | string | null;
  lastBrokerMessageAt: Date | string | null;
  twoWayExchangeDaysLast5: number;
  customerSentPdf: boolean;
  customerSentImage: boolean;
  hasBrokerMessageEver: boolean;
  hasAnyMessageEver: boolean;
  ai: {
    conversationStage?: string | null;
    customerIntent?: string | null;
    pendingFrom?: string | null;
    summary?: string | null;
    nextBestAction?: string | null;
    risk?: string | null;
    objections?: unknown[];
    buyingSignals?: unknown[];
    lastAnalyzedAt?: Date | string | null;
  } | null;
};

export type NegotiationAssessment = {
  level: NegotiationLevel | null;
  hasCrmConversation: boolean;
  customerWaiting: boolean;
  replyOwedBy: NegotiationReplyOwedBy;
  lastExchangeAt: string | null;
  daysAtStage: number | null;
  statusBehindAi: boolean;
};

const ADVANCED_STATUSES = new Set(["quote_sent", "negotiation"]);
const CLOSING_STATUSES = new Set(["documentation_pending", "under_analysis"]);
const CLOSING_AI_STAGES = new Set(["CLOSING", "DOCUMENT_COLLECTION"]);
const ADVANCED_AI_STAGES = new Set(["NEGOTIATION", "QUOTE_PRESENTED", "CLOSING"]);
const ADVANCED_STATUS_RANK: Record<string, number> = {
  in_contact: 0,
  quote_sent: 1,
  negotiation: 2,
  documentation_pending: 3,
  under_analysis: 4,
};
const AI_STAGE_RANK: Record<string, number> = {
  INITIAL_CONTACT: 0,
  DISCOVERY: 0,
  QUALIFICATION: 0,
  QUOTE_PREPARATION: 1,
  QUOTE_PRESENTED: 1,
  NEGOTIATION: 2,
  DOCUMENT_COLLECTION: 3,
  CLOSING: 4,
};

function timestamp(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : null;
}

export function computeNegotiationLevel(input: NegotiationSignals): NegotiationAssessment {
  const now = input.now.getTime();
  const customerAt = timestamp(input.lastCustomerMessageAt);
  const brokerAt = timestamp(input.lastBrokerMessageAt);
  const latestAt = Math.max(customerAt ?? -Infinity, brokerAt ?? -Infinity);
  const activeCutoff = now - NEGOTIATION_LIMITS.activeExchangeDays * 24 * 60 * 60 * 1000;
  const hasRecentTwoWay = customerAt !== null && brokerAt !== null && customerAt >= activeCutoff && brokerAt >= activeCutoff;
  const customerWaiting = customerAt !== null && (brokerAt === null || customerAt > brokerAt);
  const replyOwedBy: NegotiationReplyOwedBy = customerWaiting ? "broker" : brokerAt !== null && (customerAt === null || brokerAt > customerAt) ? "customer" : "none";
  const advancedStatus = ADVANCED_STATUSES.has(input.status);
  const closingStatus = CLOSING_STATUSES.has(input.status);
  const aiStage = input.ai?.conversationStage ?? "UNKNOWN";
  const advancedSignal = advancedStatus || closingStatus || ADVANCED_AI_STAGES.has(aiStage);
  const closingSignal = closingStatus || CLOSING_AI_STAGES.has(aiStage) || input.customerSentPdf || (input.customerSentImage && aiStage === "DOCUMENT_COLLECTION");
  const noCrmConversation = (advancedStatus || closingStatus) && !input.hasBrokerMessageEver;
  const waitingTooLong = customerWaiting && customerAt !== null && now - customerAt >= NEGOTIATION_LIMITS.staleReplyHours * 60 * 60 * 1000;
  const exchangeStale = latestAt === -Infinity || now - latestAt >= NEGOTIATION_LIMITS.activeExchangeDays * 24 * 60 * 60 * 1000;

  let level: NegotiationLevel | null = null;
  if (noCrmConversation) {
    level = "no_crm_conversation";
  } else if (waitingTooLong) {
    level = "cooling";
  } else if (hasRecentTwoWay && closingSignal) {
    level = "closing";
  } else if (hasRecentTwoWay && input.twoWayExchangeDaysLast5 >= 2 && advancedSignal) {
    level = "advanced";
  } else if (hasRecentTwoWay) {
    level = "in_conversation";
  } else if (advancedSignal && exchangeStale) {
    level = "cooling";
  }

  const stageAt = timestamp(input.stageEnteredAt);
  const daysAtStage = stageAt === null ? null : Math.max(0, Math.floor((now - stageAt) / (24 * 60 * 60 * 1000)));
  const crmConversation = input.hasAnyMessageEver || input.hasBrokerMessageEver || customerAt !== null;
  const aiRank = AI_STAGE_RANK[aiStage];
  const statusRank = ADVANCED_STATUS_RANK[input.status];

  return {
    level,
    hasCrmConversation: crmConversation,
    customerWaiting,
    replyOwedBy,
    lastExchangeAt: latestAt === -Infinity ? null : new Date(latestAt).toISOString(),
    daysAtStage,
    statusBehindAi: aiRank !== undefined && statusRank !== undefined && aiRank > statusRank,
  };
}
