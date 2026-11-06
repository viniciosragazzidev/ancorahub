import { z } from "zod";

export const POST_SALE_CAMPAIGN_MAX_LEADS = 300;
export const POST_SALE_SURVEY_COOLDOWN_DAYS = 60;
export const POST_SALE_HUMAN_ACTIVE_WINDOW_HOURS = 24;
export const POST_SALE_LEAD_STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted", "lost"] as const;

export const postSaleAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lead"), leadId: z.string().trim().min(1).max(80) }),
  z.object({ kind: z.literal("leadIds"), leadIds: z.array(z.string().trim().min(1).max(80)).min(1).max(500) }),
  z.object({
    kind: z.literal("broker"),
    brokerId: z.string().trim().min(1).max(80),
    arrivalFrom: z.string().date().optional(),
    arrivalTo: z.string().date().optional(),
  }),
  z.object({
    kind: z.literal("filters"),
    types: z.array(z.enum(["PF", "PJ"])).max(2).default([]),
    statuses: z.array(z.enum(POST_SALE_LEAD_STATUSES)).max(POST_SALE_LEAD_STATUSES.length).default([]),
    queueId: z.string().trim().min(1).max(80).optional(),
    branchId: z.string().trim().min(1).max(80).optional(),
    arrivalFrom: z.string().date().optional(),
    arrivalTo: z.string().date().optional(),
  }),
]);

export type PostSaleAudience = z.infer<typeof postSaleAudienceSchema>;

export type PostSaleExclusionReason =
  | "invalid_phone"
  | "opted_out"
  | "wrong_number"
  | "recent_survey"
  | "human_active"
  | "unassigned"
  | "source_unavailable"
  | "template_unapproved";

export type PostSaleEligibilitySignals = {
  phone: string;
  brokerId: string | null;
  optedOut: boolean;
  wrongNumber: boolean;
  recentSurvey: boolean;
  humanActive: boolean;
  sourceAvailable: boolean;
  templateApproved: boolean;
};

export type PostSaleSourceMessage = {
  direction: string;
  provider: string;
  communicationChannelId: string | null;
  wahaNumberId: string | null;
};

export function isPostSaleOptedOut(input: { conversationOptOutAt?: Date | null; durableOptOut?: boolean; optedOutSurvey?: boolean }) {
  return Boolean(input.conversationOptOutAt || input.durableOptOut || input.optedOutSurvey);
}

/** Prefer the first inbound; form leads without a reply use their first outbound contact. */
export function pickPostSaleSourceMessage(messages: readonly PostSaleSourceMessage[]) {
  return messages.find((message) => message.direction === "incoming" || message.direction === "inbound")
    ?? messages.find((message) => message.direction === "outgoing" || message.direction === "outbound")
    ?? null;
}

export function evaluatePostSaleEligibility(signals: PostSaleEligibilitySignals): PostSaleExclusionReason | null {
  const digits = signals.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "invalid_phone";
  if (signals.optedOut) return "opted_out";
  if (signals.wrongNumber) return "wrong_number";
  if (signals.recentSurvey) return "recent_survey";
  if (signals.humanActive) return "human_active";
  if (!signals.brokerId) return "unassigned";
  if (!signals.sourceAvailable) return "source_unavailable";
  if (!signals.templateApproved) return "template_unapproved";
  return null;
}

export const POST_SALE_EXCLUSION_LABELS: Record<PostSaleExclusionReason, string> = {
  invalid_phone: "telefone inválido",
  opted_out: "cliente pediu para parar",
  wrong_number: "telefone marcado como incorreto",
  recent_survey: "pesquisado nos últimos 60 dias",
  human_active: "conversa humana ativa nas últimas 24 horas",
  unassigned: "lead sem corretor responsável",
  source_unavailable: "número de origem indisponível",
  template_unapproved: "template de pós-venda ainda não aprovado",
};

const openingVariablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function findUnknownPostSaleOpeningVariables(message: string) {
  const allowed = new Set<string>(["nome", "assistente", "empresa", "corretor"]);
  return [...message.matchAll(openingVariablePattern)]
    .map((match) => match[1].trim())
    .filter((variable) => !allowed.has(variable));
}

export function renderPostSaleOpeningMessage(message: string, values: Record<string, string>) {
  return message.replace(openingVariablePattern, (_match, key: string) => values[key.trim()] ?? "");
}

export function firstName(name: string | null | undefined) {
  const clean = (name ?? "").trim().replace(/\s+/g, " ");
  return clean.split(" ")[0] || "Cliente";
}
