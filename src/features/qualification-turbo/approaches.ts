/**
 * Approach = how the qualification opens for a kind of lead (plan §5, pilar E).
 * Chosen from what the ad and the form already told us; every approach lists
 * the first-contact templates it may test (A/B) and shares the reminder cadence.
 */
export type ApproachId = "direta" | "pme" | "operadora" | "ctwa";

export type Approach = {
  id: ApproachId;
  label: string;
  /** First-contact templates tested in this approach (only approved ones run). */
  firstContactTemplates: string[];
};

export const APPROACHES: Record<ApproachId, Approach> = {
  direta: { id: "direta", label: "Individual e família", firstContactTemplates: ["anc_t0_direta", "anc_t0_canal", "anc_t0_assistente"] },
  pme: { id: "pme", label: "Empresarial (CNPJ/MEI)", firstContactTemplates: ["anc_t0_pme"] },
  operadora: { id: "operadora", label: "Operadora pedida no anúncio", firstContactTemplates: ["anc_t0_operadora", "anc_t0_direta"] },
  // Clique para WhatsApp: o cliente escreveu primeiro, então a conversa já está aberta e é grátis.
  ctwa: { id: "ctwa", label: "Anúncio de clique para WhatsApp", firstContactTemplates: [] },
};

/** Template used instead of the approach's tests between 22h and 7h (São Paulo). */
export const NIGHT_TEMPLATE = "anc_t0_noite";

export type ApproachInput = {
  tipo?: string | null;
  origem?: string | null;
  externalId?: string | null;
  sourceCampaign?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
};

const KNOWN_OPERATORS = ["amil", "bradesco", "sulamerica", "sul america", "unimed", "hapvida", "notredame", "porto seguro", "assim", "golden cross", "prevent senior", "leve saude", "medsenior", "careplus"];

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function titleCase(value: string) {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/** The operator the person asked for: the form answer first, then a tag or name in the campaign. */
export function requestedOperator(input: ApproachInput): string | null {
  const metadata = input.sourceMetadata ?? {};
  const fromForm = text(metadata.operadora).trim();
  if (fromForm) return fromForm;
  const campaign = normalize(`${text(metadata.campaignName)} ${input.sourceCampaign ?? ""} ${text(metadata.adHeadline)}`);
  const found = KNOWN_OPERATORS.find((operator) => new RegExp(`\\b${operator}\\b`).test(campaign));
  return found ? titleCase(found === "sulamerica" ? "SulAmérica" : found) : null;
}

/**
 * Variables of the qualification templates, in the outbox order: nome, nome_bot, empresa and,
 * only when known, operadora. The outbox refuses an empty variable, so an unknown operator
 * is left out instead of sent as "" (22/10: every lead without an operator in the campaign,
 * like the PME ones, failed the first message and was disqualified).
 */
export function qualificationTemplateVariables(nome: string, botName: string, empresa: string, operadora: string | null) {
  const values = [nome.trim() || "Cliente", botName.trim() || "Assistente", empresa.trim() || "Âncora Saúde"];
  return operadora?.trim() ? [...values, operadora.trim()] : values;
}

/** Company lead: PJ type, CNPJ answer in the form, or a [PME]/empresarial/MEI campaign. */
export function isCompanyLead(input: ApproachInput) {
  const metadata = input.sourceMetadata ?? {};
  if ((input.tipo ?? "").toUpperCase() === "PJ") return true;
  if (text(metadata.tipoCnpj).trim() || metadata.companyEvidence) return true;
  const tipoPlano = normalize(text(metadata.tipoPlano));
  if (/empresa|pme|cnpj|mei|pj\b/.test(tipoPlano)) return true;
  const campaign = normalize(`${text(metadata.campaignName)} ${input.sourceCampaign ?? ""}`);
  return /\[pme\]|\bpme\b|empresarial|\bcnpj\b|\bmei\b/.test(campaign);
}

export function isClickToWhatsAppLead(input: ApproachInput) {
  return (input.externalId ?? "").startsWith("ctwa:") || Boolean(text(input.sourceMetadata?.ctwaClid));
}

export function resolveApproach(input: ApproachInput): Approach {
  if (isClickToWhatsAppLead(input)) return APPROACHES.ctwa;
  if (isCompanyLead(input)) return APPROACHES.pme;
  if (requestedOperator(input)) return APPROACHES.operadora;
  return APPROACHES.direta;
}

/** São Paulo hour of a date (0-23). */
export function saoPauloHour(date: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function isNightInSaoPaulo(date: Date) {
  const hour = saoPauloHour(date);
  return hour >= 22 || hour < 7;
}
