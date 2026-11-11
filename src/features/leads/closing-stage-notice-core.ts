/**
 * "Lead na etapa de fechamento" (03/11): when a lead enters the closing stage
 * (documents sent, operator analysis) its broker is congratulated and reminded
 * of what to register so the sale closes. Pure rules, no I/O.
 */

/** The funnel's closing stage: the same statuses the negotiations radar reads as closing. */
export const CLOSING_STAGE_STATUSES: ReadonlySet<string> = new Set(["documentation_pending", "under_analysis"]);

/** Filter value for "Fechamento" in /leads (?status=closing): the two closing statuses together. */
export const CLOSING_STAGE_FILTER = "closing";

/** Entering the stage from outside it; moving inside it (Documentação → Em análise) or re-saving is not an entry. */
export function entersClosingStage(previousStatus: string, newStatus: string) {
  return CLOSING_STAGE_STATUSES.has(newStatus) && !CLOSING_STAGE_STATUSES.has(previousStatus);
}

/**
 * One key per lead and broker for the WhatsApp outbox and the in-app inbox,
 * both unique per tenant: leaving and re-entering the stage never sends twice.
 */
export function closingStageNoticeKey(leadId: string, brokerId: string) {
  return `lead-closing-stage:${leadId}:${brokerId}`;
}

/** WhatsApp variables, in the order of the `leadClosingStage` event: broker, lead, lead id (link). */
export function closingStageNoticeVariables(input: { brokerName: string | null; leadName: string | null; leadId: string }) {
  return [
    input.brokerName?.trim().split(/\s+/)[0] || "Corretor(a)",
    input.leadName?.trim() || "Seu cliente",
    input.leadId,
  ];
}

/** The in-app and push copy (the WhatsApp text lives in the team notice versions). */
export function closingStageInAppNotice(leadName: string | null) {
  const lead = leadName?.trim() || "Seu cliente";
  return {
    title: `Parabéns! ${lead} está em fechamento`,
    message: `Para finalizar com sucesso, registre no CRM: valor, nº de vidas, operadora/plano, documentos e data.`,
    pushTitle: "Lead em fechamento 🎉",
    pushBody: `${lead}: registre valor, vidas, operadora/plano, documentos e data.`,
  };
}
