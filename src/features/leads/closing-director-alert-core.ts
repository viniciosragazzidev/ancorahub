/**
 * "Fechamento para a direção" (04/11, pedido do Vinicios): when a lead enters
 * the closing stage, the numbers the director chose (Keyla, the general
 * director, on Âncora) get a WhatsApp with the client, the broker and the
 * AI summary of the conversation. Pure rules, no I/O.
 */

export const CLOSING_DIRECTOR_NOTICE_KEY = "LEAD_CLOSING_DIRECTOR";
export const CLOSING_DIRECTOR_PURPOSE = "leadClosingDirectorAlert";
export const MAX_CLOSING_DIRECTOR_RECIPIENTS = 5;

/** Per tenant, in system_settings (same pattern as the company-number routing): no migration. */
export function closingDirectorRecipientsKey(tenantId: string) {
  return `closing_director_recipients_${tenantId}`;
}

/** Números de cada aviso enviado a telefones digitados (05/11): o fechamento mantém a chave antiga. */
export function noticeRecipientsKey(noticeKey: string, tenantId: string) {
  return noticeKey === CLOSING_DIRECTOR_NOTICE_KEY ? closingDirectorRecipientsKey(tenantId) : `team_notice_recipients_${noticeKey}_${tenantId}`;
}

/** Digits only, with the Brazil code: "(21) 96462-5966" and "+55 21 96462-5966" are the same number. */
export function normalizeRecipientPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

/** Parses the stored value (JSON list) or a typed list (one per line, comma or semicolon). Invalid entries are dropped. */
export function parseRecipientPhones(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  let items: unknown = null;
  try {
    items = JSON.parse(value);
  } catch {
    items = value.split(/[\n,;]+/);
  }
  if (!Array.isArray(items)) return [];
  const phones = items
    .filter((item): item is string => typeof item === "string")
    .map(normalizeRecipientPhone)
    .filter((phone): phone is string => Boolean(phone));
  return [...new Set(phones)].slice(0, MAX_CLOSING_DIRECTOR_RECIPIENTS);
}

/** "5521964625966" → "(21) 96462-5966" (for the settings field and the message). */
export function formatRecipientPhone(phone: string) {
  const local = phone.startsWith("55") && phone.length >= 12 ? phone.slice(2) : phone;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Once per lead and number: leaving and re-entering the stage never sends twice. */
export function closingDirectorAlertKey(leadId: string, phone: string) {
  return `lead-closing-director:${leadId}:${phone}`;
}

const STAGE_LABELS: Record<string, string> = {
  documentation_pending: "Documentação",
  under_analysis: "Em análise",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** The outbox caps each variable at 512 characters. */
function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export type ClosingDirectorAlertInput = {
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  leadType: string | null;
  livesCount: number | null;
  monthlyValue: string | number | null;
  planName: string | null;
  brokerName: string | null;
  stage: string;
  summary: string | null;
};

/** One line about the deal: type, lives, plan and value, only what is filled in. */
export function closingDealLine(input: Pick<ClosingDirectorAlertInput, "leadType" | "livesCount" | "monthlyValue" | "planName">) {
  const parts: string[] = [];
  const type = input.leadType?.trim().toUpperCase();
  if (type) parts.push(type === "PF" ? "Pessoa física" : type === "PJ" ? "Empresa (PJ)" : input.leadType!.trim());
  if (input.livesCount && input.livesCount > 0) parts.push(input.livesCount === 1 ? "1 vida" : `${input.livesCount} vidas`);
  if (input.planName?.trim()) parts.push(input.planName.trim());
  const value = input.monthlyValue === null || input.monthlyValue === "" ? Number.NaN : Number(input.monthlyValue);
  if (Number.isFinite(value) && value > 0) parts.push(`${brl.format(value)}/mês`);
  return parts.join(" · ") || "Sem valor e vidas registrados ainda";
}

/**
 * WhatsApp variables, in the order of the `leadClosingDirectorAlert` event:
 * client, client phone, deal line, broker, stage, conversation summary, lead id (link).
 */
export function closingDirectorAlertVariables(input: ClosingDirectorAlertInput) {
  const phoneDigits = input.leadPhone?.replace(/\D/g, "") ?? "";
  return [
    clip(input.leadName || "Cliente", 120),
    phoneDigits ? formatRecipientPhone(phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`) : "Sem telefone",
    clip(closingDealLine(input), 200),
    clip(input.brokerName || "Sem corretor", 120),
    STAGE_LABELS[input.stage] ?? "Fechamento",
    clip(input.summary || "A IA ainda não resumiu esta conversa.", 500),
    input.leadId,
  ];
}
