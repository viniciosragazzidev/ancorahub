import { COMPLAINT_KIND_LABELS, hasIntent, readIntentState, RESUME_INTENTS } from "./intents";
import { lossReasonCheckSummary, readLossReasonCheck } from "./loss-reason-check";

export const POST_SALE_ALERT_REASONS = ["no_contact", "bad_service", "low_rating", "wants_help", "not_attended", "team_no_reply", "loss_reason_mismatch", "wants_resume", "broker_complaint", "health_urgency"] as const;

export type PostSaleAlertReason = (typeof POST_SALE_ALERT_REASONS)[number];

export const POST_SALE_ALERT_REASON_LABELS: Record<PostSaleAlertReason, string> = {
  no_contact: "Cliente não conseguiu falar com o corretor",
  bad_service: "Cliente relatou uma experiência ruim",
  low_rating: "Cliente deu nota 2 ou menos",
  wants_help: "Cliente pediu ajuda da equipe",
  not_attended: "Cliente diz que não foi atendido",
  team_no_reply: "Cliente voltou a escrever e ficou 15 min sem resposta da equipe",
  loss_reason_mismatch: "Motivo de perda diferente do registrado",
  wants_resume: "Quer retomar o atendimento",
  broker_complaint: "Reclamação do atendimento",
  health_urgency: "Cliente relatou urgência de saúde",
};

export type PostSaleAlertState = {
  outcome: string | null;
  rating: number | null;
  answers: unknown;
};

function answerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function postSaleAlertReasons(state: PostSaleAlertState): PostSaleAlertReason[] {
  const answers = answerRecord(state.answers);
  const reasons: PostSaleAlertReason[] = [];
  const intents = readIntentState(answers);
  const resume = hasIntent(intents, ...RESUME_INTENTS);
  const notAttended = state.outcome === "no_contact" || state.outcome === "r0_not_attended";
  // Reclamação de "sumiu, ninguém respondeu" junto com "não foi atendido" seria o mesmo alerta duas vezes.
  const complaint = hasIntent(intents, "complaint") && !(notAttended && intents?.complaintKind === "disappeared");
  // Nota 4 ou 5 vence um "negativo" solto ("foi 5, o problema é que agora não dá"): precisão do alerta (09/11).
  const negativeAnswer = answers.sentiment === "negative" && !(typeof state.rating === "number" && state.rating >= 4);
  if (state.outcome === "no_contact") reasons.push("no_contact");
  if ((state.outcome === "bad_service" || negativeAnswer) && !complaint) reasons.push("bad_service");
  if (typeof state.rating === "number" && state.rating <= 2) reasons.push("low_rating");
  if (answers.wantsHelp === true && !resume) reasons.push("wants_help");
  // R0 (cliente que volta a escrever): resposta "não fui atendido" e escalada sem retorno da equipe.
  if (state.outcome === "r0_not_attended") reasons.push("not_attended");
  const r0 = answerRecord(answers.r0);
  if (typeof r0.escalatedAt === "string" && r0.escalatedAt) reasons.push("team_no_reply");
  // R4: motivo do cliente em outra categoria que a do corretor (gravado ao concluir, em answers.lossCheck).
  if (readLossReasonCheck(answers)?.divergent) reasons.push("loss_reason_mismatch");
  // Conversa inteligente (09/11): pediu preço, falar com alguém ou horário; reclamou; urgência de saúde.
  if (resume) reasons.push("wants_resume");
  if (complaint) reasons.push("broker_complaint");
  if (hasIntent(intents, "health_urgency")) reasons.push("health_urgency");
  return reasons;
}

function quoted(text: string | null | undefined, max = 160) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  return `"${value.length > max ? `${value.slice(0, max - 3)}...` : value}"`;
}

/** Detalhe do alerta (lista de alertas e notificação): as duas versões do motivo, o horário pedido, a fala do cliente. */
export function postSaleAlertDetail(reason: PostSaleAlertReason, answers: unknown): string | null {
  if (reason === "loss_reason_mismatch") {
    const check = readLossReasonCheck(answers);
    return check ? lossReasonCheckSummary(check) : null;
  }
  const intents = readIntentState(answers);
  if (!intents) return null;
  if (reason === "wants_resume") {
    return [
      intents.scheduleText ? `Pediu contato: ${intents.scheduleText}.` : null,
      intents.list.includes("price_request") ? "Pediu valores." : null,
      quoted(intents.requestQuote) ? `Cliente: ${quoted(intents.requestQuote)}` : null,
    ].filter(Boolean).join(" ") || null;
  }
  if (reason === "broker_complaint") {
    const kind = intents.complaintKind && intents.complaintKind !== "other" ? `(${COMPLAINT_KIND_LABELS[intents.complaintKind]}) ` : "";
    const quote = quoted(intents.complaintQuote);
    return quote ? `${kind}Cliente: ${quote}` : kind.trim() || null;
  }
  if (reason === "health_urgency") {
    const quote = quoted(intents.requestQuote ?? intents.complaintQuote ?? intents.questionText);
    return quote ? `Cliente: ${quote}` : null;
  }
  return null;
}

/** Texto da notificação: o rótulo do motivo e o detalhe, quando houver. */
export function postSaleAlertMessage(reason: PostSaleAlertReason, answers: unknown) {
  const label = POST_SALE_ALERT_REASON_LABELS[reason];
  const detail = postSaleAlertDetail(reason, answers);
  return detail ? `${label}. ${detail}` : label;
}

/** Reasons that must notify again on every new client message (a second health emergency, a new
 *  request to talk): the key carries the triggering message (Vigia, 09/11). */
const REPEATABLE_ALERT_REASONS = new Set<PostSaleAlertReason>(["health_urgency", "wants_resume"]);

export function postSaleAlertIdempotencyKey(surveyId: string, reason: PostSaleAlertReason, recipientUserId: string, triggerMessageId?: string | null) {
  const base = `post-sale-alert:${surveyId}:${reason}:${recipientUserId}`;
  return REPEATABLE_ALERT_REASONS.has(reason) && triggerMessageId ? `${base}:${triggerMessageId}` : base;
}

export function isPostSaleAlertOpen(state: PostSaleAlertState & { alertsHandledAt: Date | null }) {
  return state.alertsHandledAt === null && postSaleAlertReasons(state).length > 0;
}
