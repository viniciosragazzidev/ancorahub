/** Quem pode entrar no piloto (§1 do plano). Puro: o servidor reúne os dados e decide aqui. */

export const ELIGIBLE_LEAD_STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "awaiting_reply"] as const;

export type EligibilityInput = {
  qualificationStatus: string | null;
  status: string;
  telefone: string | null;
  consentimentoLgpd: boolean;
  corretorId: string | null;
  deletedAt: Date | null;
  archivedAt: Date | null;
  optOutAt: Date | null;
  metaBlockedRecently: boolean;
  postSaleOptOut: boolean;
  openDeal: boolean;
};

export type IneligibleReason = "not_hot" | "stage" | "no_phone" | "no_consent" | "has_broker" | "removed" | "opt_out" | "meta_blocked" | "post_sale" | "open_deal";

export const INELIGIBLE_LABEL: Record<IneligibleReason, string> = {
  not_hot: "Não está quente",
  stage: "Etapa fora do piloto",
  no_phone: "Sem telefone válido",
  no_consent: "Sem base legal (consentimento ou mensagem do cliente)",
  has_broker: "Já tem corretor",
  removed: "Arquivado ou excluído",
  opt_out: "Pediu para não receber mensagens",
  meta_blocked: "Bloqueio recente da Meta",
  post_sale: "Em pós-venda",
  open_deal: "Já está numa negociação",
};

export function hasValidPhone(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

/** Todos os motivos que impedem o lead; lista vazia = elegível. */
export function autoSaleIneligibleReasons(input: EligibilityInput): IneligibleReason[] {
  const reasons: IneligibleReason[] = [];
  if (input.deletedAt || input.archivedAt) reasons.push("removed");
  if (input.qualificationStatus !== "hot") reasons.push("not_hot");
  if (input.status === "converted") reasons.push("post_sale");
  else if (!(ELIGIBLE_LEAD_STATUSES as readonly string[]).includes(input.status)) reasons.push("stage");
  if (input.postSaleOptOut && !reasons.includes("post_sale")) reasons.push("post_sale");
  if (!hasValidPhone(input.telefone)) reasons.push("no_phone");
  if (!input.consentimentoLgpd) reasons.push("no_consent");
  // D1: só lead que nenhum corretor aceitou. O agente nunca tira lead de corretor.
  if (input.corretorId) reasons.push("has_broker");
  if (input.optOutAt) reasons.push("opt_out");
  if (input.metaBlockedRecently) reasons.push("meta_blocked");
  if (input.openDeal) reasons.push("open_deal");
  return reasons;
}
