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

/**
 * Qualification statuses a reopen may restart: not qualified yet, stuck in qualification, or
 * disqualified (what the failed send leads to). A qualified lead (hot, warm, cold, qualified)
 * would lose its stage, so it stays out.
 */
const REOPENABLE_QUALIFICATION_STATUSES = new Set(["", "pending", "qualifying", "disqualified", "not_qualified"]);

export type AiSendFailedLeadFacts = {
  leadId: string;
  status: string;
  corretorId: string | null;
  qualificationStatus: string | null;
  /** The queue's AI switch; false keeps the AI from talking to the lead (null: no queue). */
  queueAiEnabled: boolean | null;
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
      | "queue_ai_disabled"
      | "already_qualified"
      | "no_failed_ai_message"
      | "delivered_after_failure"
      | "no_customer_message"
      | "window_closed";
  };

export const AI_SEND_FAILED_SKIP_LABEL: Record<Extract<AiSendFailedDecision, { eligible: false }>["reason"], string> = {
  has_broker: "já tem corretor",
  closed_status: "lead fechado ou distribuído",
  queue_ai_disabled: "a fila está com a IA desligada",
  already_qualified: "já foi qualificado",
  no_failed_ai_message: "a última mensagem da IA não falhou",
  delivered_after_failure: "já houve envio entregue depois da falha",
  no_customer_message: "sem mensagem do cliente",
  window_closed: "a janela de 24 h já fechou",
};

/** Reasons startAiQualificationForLead gives when it does not send (plain Portuguese for the team). */
export const AI_START_SKIP_LABEL: Record<string, string> = {
  already_started: "já existe uma qualificação em andamento",
  missing_channel: "não há canal ativo para enviar",
  source_channel_unavailable: "o canal que o cliente usa está desconectado",
  channel_lookup_failed: "não foi possível escolher o canal",
  missing_phone: "o lead não tem telefone",
};

export type AiRestartDecision = { send: true } | { send: false; reason: "window_closed" | "already_delivered" };

export const AI_RESTART_SKIP_LABEL: Record<Extract<AiRestartDecision, { send: false }>["reason"], string> = {
  window_closed: "janela de 24 h fechada: reaberto sem mensagem",
  already_delivered: "já houve envio entregue depois da falha",
};

/**
 * Whether the AI should send its first message again right after the reopen: only inside the customer's
 * window (the Meta refuses free text after it) and only if nothing was delivered after the failure.
 */
export function decideAiRestartDispatch(input: { windowEndsAt: Date; now: Date; deliveredAfterLastAi: boolean }): AiRestartDecision {
  if (input.deliveredAfterLastAi) return { send: false, reason: "already_delivered" };
  if (input.now.getTime() >= input.windowEndsAt.getTime()) return { send: false, reason: "window_closed" };
  return { send: true };
}

/** Whether a lead can be reopened because the AI's first message was refused and the customer's window is still open. */
export function decideAiSendFailedCandidate(facts: AiSendFailedLeadFacts, now: Date): AiSendFailedDecision {
  if (facts.corretorId) return { eligible: false, reason: "has_broker" };
  if (CLOSED_LEAD_STATUSES.has(facts.status)) return { eligible: false, reason: "closed_status" };
  if (facts.queueAiEnabled === false) return { eligible: false, reason: "queue_ai_disabled" };
  if (!REOPENABLE_QUALIFICATION_STATUSES.has(facts.qualificationStatus ?? "")) return { eligible: false, reason: "already_qualified" };
  if (!facts.lastAiFailed || !facts.lastAiSentAt) return { eligible: false, reason: "no_failed_ai_message" };
  if (facts.deliveredAfterLastAi) return { eligible: false, reason: "delivered_after_failure" };
  if (!facts.lastCustomerInboundAt) return { eligible: false, reason: "no_customer_message" };
  const windowEndsAt = new Date(facts.lastCustomerInboundAt.getTime() + CUSTOMER_WINDOW_MS);
  if (now.getTime() >= windowEndsAt.getTime()) return { eligible: false, reason: "window_closed" };
  // A lead stuck in "qualifying" is the main case (the AI started, its message never left), so it stays
  // eligible; a second run is idempotent because a delivered resend makes the last AI message not failed.
  return { eligible: true, failedAt: facts.lastAiSentAt, windowEndsAt };
}
