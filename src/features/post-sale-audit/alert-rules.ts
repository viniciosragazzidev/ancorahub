export const POST_SALE_ALERT_REASONS = ["no_contact", "bad_service", "low_rating", "wants_help", "not_attended", "team_no_reply"] as const;

export type PostSaleAlertReason = (typeof POST_SALE_ALERT_REASONS)[number];

export const POST_SALE_ALERT_REASON_LABELS: Record<PostSaleAlertReason, string> = {
  no_contact: "Cliente não conseguiu falar com o corretor",
  bad_service: "Cliente relatou uma experiência ruim",
  low_rating: "Cliente deu nota 2 ou menos",
  wants_help: "Cliente pediu ajuda da equipe",
  not_attended: "Cliente diz que não foi atendido",
  team_no_reply: "Cliente voltou a escrever e ficou 15 min sem resposta da equipe",
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
  if (state.outcome === "no_contact") reasons.push("no_contact");
  if (state.outcome === "bad_service" || answers.sentiment === "negative") reasons.push("bad_service");
  if (typeof state.rating === "number" && state.rating <= 2) reasons.push("low_rating");
  if (answers.wantsHelp === true) reasons.push("wants_help");
  // R0 (cliente que volta a escrever): resposta "não fui atendido" e escalada sem retorno da equipe.
  if (state.outcome === "r0_not_attended") reasons.push("not_attended");
  const r0 = answerRecord(answers.r0);
  if (typeof r0.escalatedAt === "string" && r0.escalatedAt) reasons.push("team_no_reply");
  return reasons;
}

export function postSaleAlertIdempotencyKey(surveyId: string, reason: PostSaleAlertReason, recipientUserId: string) {
  return `post-sale-alert:${surveyId}:${reason}:${recipientUserId}`;
}

export function isPostSaleAlertOpen(state: PostSaleAlertState & { alertsHandledAt: Date | null }) {
  return state.alertsHandledAt === null && postSaleAlertReasons(state).length > 0;
}
