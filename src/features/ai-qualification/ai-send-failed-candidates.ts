/**
 * Candidatos a "reabrir qualificação" quando a mensagem da IA não saiu (28/10): a Meta recusou
 * (131047) e o lead ficou parado. Regra pura; quem busca os fatos no banco é bulk-qualification-actions.ts.
 */

const HOUR_MS = 60 * 60 * 1000;

/** The customer's window is 24 h after their last message: a reopen only helps inside it. */
export const CUSTOMER_WINDOW_MS = 24 * HOUR_MS;

/** How far back the failed AI messages are looked for. */
export const AI_SEND_FAILED_LOOKBACK_MS = 3 * 24 * HOUR_MS;

/** Statuses that a reopen must never touch: the lead is already closed or in a broker's hands. */
const CLOSED_LEAD_STATUSES = new Set(["converted", "lost", "distributed"]);

export type AiSendFailedLeadFacts = {
  leadId: string;
  status: string;
  corretorId: string | null;
  qualificationStatus: string | null;
  /** The AI's most recent message to the lead, if any. */
  lastAiSentAt: Date | null;
  lastAiFailed: boolean;
  /** An outbound message delivered (sent, delivered or read) after the AI's last message. */
  deliveredAfterLastAi: boolean;
  /** The customer's most recent inbound message, within the lookback. */
  lastCustomerInboundAt: Date | null;
};

export type AiSendFailedDecision =
  | { eligible: true; failedAt: Date; windowEndsAt: Date }
  | {
    eligible: false;
    reason:
      | "has_broker"
      | "closed_status"
      | "no_failed_ai_message"
      | "delivered_after_failure"
      | "no_customer_message"
      | "window_closed"
      | "already_qualifying";
  };

export const AI_SEND_FAILED_SKIP_LABEL: Record<Extract<AiSendFailedDecision, { eligible: false }>["reason"], string> = {
  has_broker: "já tem corretor",
  closed_status: "lead fechado ou distribuído",
  no_failed_ai_message: "a última mensagem da IA não falhou",
  delivered_after_failure: "já houve envio entregue depois da falha",
  no_customer_message: "sem mensagem do cliente",
  window_closed: "a janela de 24 h já fechou",
  already_qualifying: "já está em qualificação",
};

/** Whether a lead can be reopened because the AI's first message was refused and the customer's window is still open. */
export function decideAiSendFailedCandidate(facts: AiSendFailedLeadFacts, now: Date): AiSendFailedDecision {
  if (facts.corretorId) return { eligible: false, reason: "has_broker" };
  if (CLOSED_LEAD_STATUSES.has(facts.status)) return { eligible: false, reason: "closed_status" };
  if (!facts.lastAiFailed || !facts.lastAiSentAt) return { eligible: false, reason: "no_failed_ai_message" };
  if (facts.deliveredAfterLastAi) return { eligible: false, reason: "delivered_after_failure" };
  if (!facts.lastCustomerInboundAt) return { eligible: false, reason: "no_customer_message" };
  const windowEndsAt = new Date(facts.lastCustomerInboundAt.getTime() + CUSTOMER_WINDOW_MS);
  if (now.getTime() >= windowEndsAt.getTime()) return { eligible: false, reason: "window_closed" };
  // Already reopened: a second run must not reopen the same lead again.
  if (facts.qualificationStatus === "qualifying") return { eligible: false, reason: "already_qualifying" };
  return { eligible: true, failedAt: facts.lastAiSentAt, windowEndsAt };
}
