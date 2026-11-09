import { z } from "zod";

/**
 * Régua automática do pós-venda (Fase 4 do plano 2026-11-06): regras R1 a R5.
 * Regras puras, sem I/O: marcos, atraso em dias úteis, filtros, piloto, proteções e limites.
 * O motor (auto-sweep.ts) busca os dados e aplica estas decisões. Sem node:crypto aqui: a tela também importa.
 */

export const AUTO_RULE_KEYS = ["R1", "R2", "R3", "R4", "R5"] as const;
export type AutoRuleKey = (typeof AUTO_RULE_KEYS)[number];

export type AutoRuleMilestone = "accepted" | "converted" | "lost";

export const AUTO_RULE_DEFINITIONS: Record<AutoRuleKey, {
  label: string;
  milestone: AutoRuleMilestone;
  milestoneLabel: string;
  defaultDelay: number;
  asks: string;
  condition: string;
}> = {
  R1: { label: "Checagem de atendimento", milestone: "accepted", milestoneLabel: "lead distribuído e aceito pelo corretor", defaultDelay: 1, asks: "O corretor falou com você? Foi rápido?", condition: "lead ainda aberto (não vendido, não perdido)" },
  R2: { label: "Acompanhamento", milestone: "accepted", milestoneLabel: "lead distribuído e aceito pelo corretor", defaultDelay: 5, asks: "Recebeu cotação? Como está a decisão? Nota de 1 a 5", condition: "lead ainda aberto e sem R1 respondida nos últimos 4 dias" },
  R3: { label: "Pós-venda da venda", milestone: "converted", milestoneLabel: "venda registrada", defaultDelay: 3, asks: "Como foi a contratação? Ficou alguma dúvida? Nota", condition: "só leads vendidos" },
  R4: { label: "Motivo da perda", milestone: "lost", milestoneLabel: "lead marcado como perdido", defaultDelay: 2, asks: "O que pesou na decisão?", condition: "não pergunta se o motivo for número errado ou pediu para não contatar" },
  R5: { label: "Satisfação de 30 dias", milestone: "converted", milestoneLabel: "venda registrada", defaultDelay: 30, asks: "Tudo certo com o plano? Indicaria?", condition: "ligar só depois do piloto" },
};

export const AUTO_RULE_LIMITS = {
  /** Limite padrão por regra e por dia. */
  dailyLimit: 60,
  /** Limite por empresa e por dia, somando todas as regras automáticas. */
  tenantDailyLimit: 60,
  /** Em modo piloto (filas ou corretores liberados), no máximo isso por dia. */
  pilotDailyLimit: 20,
  /** No máximo 1 conversa de pós-venda por lead nesse intervalo (manual, R0 e régua somados). */
  cooldownDays: 30,
  /** Dias úteis de tolerância depois do dia certo (motor parado, fim de semana). Mais velho que isso não sai. */
  graceBusinessDays: 2,
  /** R2 não sai se a R1 foi respondida nesse intervalo. */
  r2SkipIfR1AnsweredDays: 4,
  maxDelayBusinessDays: 60,
} as const;

/** Etapas em que o lead está aberto com o corretor (R1 e R2). */
export const AUTO_RULE_OPEN_STATUSES = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"] as const;

/** Oferta ainda não aceita: o corretor tem o lead de forma provisória, então não é marco da R1/R2. */
export const AUTO_RULE_UNACCEPTED_SOURCES = ["automatic_offer", "manual_offer", "manual_unassignment"] as const;

export function isAutoRuleKey(value: string | null | undefined): value is AutoRuleKey {
  return Boolean(value) && (AUTO_RULE_KEYS as readonly string[]).includes(value!);
}

export type AutoRuleFilters = { queueIds: string[]; branchIds: string[]; leadTypes: Array<"PF" | "PJ"> };
export type AutoRulePilot = { queueIds: string[]; brokerIds: string[] };

export type AutoRuleSettings = {
  key: AutoRuleKey;
  enabled: boolean;
  delayBusinessDays: number;
  filters: AutoRuleFilters;
  dailyLimit: number;
  pilot: AutoRulePilot;
  updatedAt: string | null;
};

const idList = z.array(z.string().trim().min(1).max(80)).max(100);

export const autoRuleSettingsInputSchema = z.object({
  key: z.enum(AUTO_RULE_KEYS),
  enabled: z.boolean(),
  delayBusinessDays: z.number().int().min(1, "O atraso precisa ser de pelo menos 1 dia útil.").max(AUTO_RULE_LIMITS.maxDelayBusinessDays, `O atraso pode ser de até ${AUTO_RULE_LIMITS.maxDelayBusinessDays} dias úteis.`),
  filters: z.object({
    queueIds: idList.default([]),
    branchIds: idList.default([]),
    leadTypes: z.array(z.enum(["PF", "PJ"])).max(2).default([]),
  }),
  dailyLimit: z.number().int().min(1, "O limite diário precisa ser de pelo menos 1.").max(AUTO_RULE_LIMITS.dailyLimit, `O limite diário pode ser de até ${AUTO_RULE_LIMITS.dailyLimit}.`),
  pilot: z.object({
    queueIds: idList.default([]),
    brokerIds: idList.default([]),
  }),
});

export type AutoRuleSettingsInput = z.infer<typeof autoRuleSettingsInputSchema>;

export function defaultAutoRuleSettings(key: AutoRuleKey): AutoRuleSettings {
  return {
    key,
    enabled: false,
    delayBusinessDays: AUTO_RULE_DEFINITIONS[key].defaultDelay,
    filters: { queueIds: [], branchIds: [], leadTypes: [] },
    dailyLimit: AUTO_RULE_LIMITS.dailyLimit,
    pilot: { queueIds: [], brokerIds: [] },
    updatedAt: null,
  };
}

const unique = (values: readonly string[]) => [...new Set(values)];

function stringArray(value: unknown) {
  return Array.isArray(value) ? unique(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())).slice(0, 100) : [];
}

/** Linha do banco (ou nada) para a regra: valores inválidos voltam ao padrão, nunca quebram a tela. */
export function parseAutoRuleRow(key: AutoRuleKey, row: {
  enabled?: unknown;
  delayBusinessDays?: unknown;
  filters?: unknown;
  dailyLimit?: unknown;
  pilot?: unknown;
  updatedAt?: Date | string | null;
} | null | undefined): AutoRuleSettings {
  const fallback = defaultAutoRuleSettings(key);
  if (!row) return fallback;
  const filters = row.filters && typeof row.filters === "object" ? row.filters as Record<string, unknown> : {};
  const pilot = row.pilot && typeof row.pilot === "object" ? row.pilot as Record<string, unknown> : {};
  const delay = typeof row.delayBusinessDays === "number" && Number.isInteger(row.delayBusinessDays) && row.delayBusinessDays >= 1 && row.delayBusinessDays <= AUTO_RULE_LIMITS.maxDelayBusinessDays ? row.delayBusinessDays : fallback.delayBusinessDays;
  const limit = typeof row.dailyLimit === "number" && Number.isInteger(row.dailyLimit) && row.dailyLimit >= 1 ? Math.min(row.dailyLimit, AUTO_RULE_LIMITS.dailyLimit) : fallback.dailyLimit;
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : typeof row.updatedAt === "string" ? row.updatedAt : null;
  return {
    key,
    enabled: row.enabled === true,
    delayBusinessDays: delay,
    filters: {
      queueIds: stringArray(filters.queueIds),
      branchIds: stringArray(filters.branchIds),
      leadTypes: stringArray(filters.leadTypes).filter((type): type is "PF" | "PJ" => type === "PF" || type === "PJ"),
    },
    dailyLimit: limit,
    pilot: { queueIds: stringArray(pilot.queueIds), brokerIds: stringArray(pilot.brokerIds) },
    updatedAt,
  };
}

/* ─── Dias úteis (seg a sex, calendário de São Paulo) ─── */

/** "2026-11-09" no fuso de São Paulo. */
export function saoPauloDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function keyToUtcNoon(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function utcNoonToKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isBusinessDateKey(key: string) {
  const weekday = keyToUtcNoon(key).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/** O N-ésimo dia útil depois da data (N = 0 devolve a própria data, ou o próximo dia útil se cair no fim de semana). */
export function addBusinessDaysToDateKey(key: string, businessDays: number) {
  const cursor = keyToUtcNoon(key);
  if (businessDays <= 0) {
    while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) cursor.setUTCDate(cursor.getUTCDate() + 1);
    return utcNoonToKey(cursor);
  }
  let left = businessDays;
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) left -= 1;
  }
  return utcNoonToKey(cursor);
}

/** Próximo dia útil depois da data (amanhã útil). */
export function nextBusinessDateKey(key: string) {
  return addBusinessDaysToDateKey(key, 1);
}

export type AutoRuleTiming = "early" | "due" | "stale";

/**
 * O lead entra na régua no dia útil "marco + atraso". Com o motor parado ou fim de semana no meio,
 * ainda sai até `grace` dias úteis depois; mais velho que isso não sai mais (ligar a régua não
 * dispara para o histórico inteiro).
 */
export function autoRuleTiming(input: { milestoneAt: Date; delayBusinessDays: number; sendDay: string; graceBusinessDays?: number }): AutoRuleTiming {
  const dueDay = addBusinessDaysToDateKey(saoPauloDateKey(input.milestoneAt), input.delayBusinessDays);
  if (input.sendDay < dueDay) return "early";
  const lastDay = addBusinessDaysToDateKey(dueDay, input.graceBusinessDays ?? AUTO_RULE_LIMITS.graceBusinessDays);
  return input.sendDay > lastDay ? "stale" : "due";
}

/** Marco mais antigo que ainda pode estar no prazo no dia de envio (para limitar a busca). */
export function autoRuleMilestoneFloor(sendDay: string, delayBusinessDays: number, graceBusinessDays: number = AUTO_RULE_LIMITS.graceBusinessDays) {
  const businessDays = delayBusinessDays + graceBusinessDays;
  const calendarDays = Math.ceil(businessDays * 7 / 5) + 4;
  const floor = keyToUtcNoon(sendDay);
  floor.setUTCDate(floor.getUTCDate() - calendarDays);
  return new Date(Date.UTC(floor.getUTCFullYear(), floor.getUTCMonth(), floor.getUTCDate()));
}

/* ─── Filtros, piloto e limites ─── */

export type AutoRuleLeadFacts = {
  status: string;
  queueId: string | null;
  branchId: string | null;
  tipo: string | null;
  brokerId: string | null;
  ownerRole: string | null;
  distributionStatus?: string | null;
  assignmentSource?: string | null;
  /** Motivo de perda registrado (código, categoria ou texto). */
  lossTexts?: Array<string | null | undefined>;
};

export function isAutoRulePilotMode(pilot: AutoRulePilot) {
  return pilot.queueIds.length > 0 || pilot.brokerIds.length > 0;
}

export function matchesAutoRuleFilters(lead: Pick<AutoRuleLeadFacts, "queueId" | "branchId" | "tipo">, filters: AutoRuleFilters) {
  if (filters.queueIds.length && (!lead.queueId || !filters.queueIds.includes(lead.queueId))) return false;
  if (filters.branchIds.length && (!lead.branchId || !filters.branchIds.includes(lead.branchId))) return false;
  if (filters.leadTypes.length && !filters.leadTypes.includes((lead.tipo === "PJ" ? "PJ" : "PF"))) return false;
  return true;
}

export function matchesAutoRulePilot(lead: Pick<AutoRuleLeadFacts, "queueId" | "brokerId">, pilot: AutoRulePilot) {
  if (!isAutoRulePilotMode(pilot)) return true;
  return Boolean((lead.queueId && pilot.queueIds.includes(lead.queueId)) || (lead.brokerId && pilot.brokerIds.includes(lead.brokerId)));
}

/** Limite diário da regra: em piloto, nunca mais que 20. */
export function effectiveAutoRuleDailyLimit(settings: Pick<AutoRuleSettings, "dailyLimit" | "pilot">) {
  const base = Math.max(0, Math.min(settings.dailyLimit, AUTO_RULE_LIMITS.dailyLimit));
  return isAutoRulePilotMode(settings.pilot) ? Math.min(base, AUTO_RULE_LIMITS.pilotDailyLimit) : base;
}

/** Quantas ainda cabem hoje: o menor entre o que sobra da regra e o que sobra da empresa. */
export function autoRuleRemainingCapacity(input: { settings: Pick<AutoRuleSettings, "dailyLimit" | "pilot">; usedByRule: number; usedByTenant: number; tenantDailyLimit?: number }) {
  const rule = effectiveAutoRuleDailyLimit(input.settings) - input.usedByRule;
  const tenant = (input.tenantDailyLimit ?? AUTO_RULE_LIMITS.tenantDailyLimit) - input.usedByTenant;
  return Math.max(0, Math.min(rule, tenant));
}

function normalize(text: string | null | undefined) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** R4 não pergunta quando o motivo é número errado ou o cliente pediu para não ser contatado. */
export function isAutoRuleLossReasonExcluded(texts: ReadonlyArray<string | null | undefined>) {
  return texts.some((raw) => {
    const text = normalize(raw?.replace(/_/g, " "));
    if (!text) return false;
    return /\b(numero|telefone|contato) (errado|incorreto|invalido|inexistente)\b/.test(text)
      || /\bwrong number\b/.test(text)
      || /\bengano\b/.test(text)
      || /\b(pediu|pede|solicitou) (para )?(nao|parar de) (ser )?(contat|ligar|chamar|mandar|receber)/.test(text)
      || /\bnao (quer|deseja) (mais )?(ser )?(contat|receber|que (ligue|chame|entre))/.test(text)
      || /\bnao (contatar|perturbe|ligar mais)\b/.test(text)
      || /\b(do not contact|opt out|optout)\b/.test(text);
  });
}

export type AutoRuleSkipReason =
  | "disabled"
  | "early"
  | "stale"
  | "filters"
  | "not_in_pilot"
  | "director_owner"
  | "not_open"
  | "not_accepted"
  | "not_converted"
  | "not_lost"
  | "loss_reason"
  | "r1_answered";

export const AUTO_RULE_SKIP_LABELS: Record<AutoRuleSkipReason, string> = {
  disabled: "regra desligada",
  early: "ainda não chegou o dia",
  stale: "marco antigo demais",
  filters: "fora dos filtros",
  not_in_pilot: "fora do piloto",
  director_owner: "lead de um diretor",
  not_open: "lead já vendido ou perdido",
  not_accepted: "lead ainda não aceito",
  not_converted: "lead não está vendido",
  not_lost: "lead não está perdido",
  loss_reason: "motivo de perda sem pergunta (número errado ou pediu para não contatar)",
  r1_answered: "R1 respondida nos últimos 4 dias",
};

/**
 * Decide se um lead entra na régua hoje, antes das proteções comuns (opt-out, número inválido,
 * conversa humana em 24 h, 30 dias entre conversas e canal de origem), que são as mesmas da
 * campanha manual e ficam no resolvePostSaleAudience.
 */
export function decideAutoRuleCandidate(input: {
  settings: Pick<AutoRuleSettings, "key" | "enabled" | "delayBusinessDays" | "filters" | "pilot">;
  lead: AutoRuleLeadFacts;
  milestoneAt: Date;
  sendDay: string;
  /** Última resposta a uma R1 deste lead (só importa para a R2). */
  lastR1AnswerAt?: Date | null;
  now: Date;
  /** Prévia: avalia como se estivesse ligada. */
  ignoreEnabled?: boolean;
}): { ok: true } | { ok: false; skip: AutoRuleSkipReason } {
  const skip = (reason: AutoRuleSkipReason) => ({ ok: false as const, skip: reason });
  const { settings, lead } = input;
  const milestone = AUTO_RULE_DEFINITIONS[settings.key].milestone;
  if (!settings.enabled && !input.ignoreEnabled) return skip("disabled");
  if (lead.ownerRole === "director") return skip("director_owner");
  if (milestone === "accepted") {
    if (!(AUTO_RULE_OPEN_STATUSES as readonly string[]).includes(lead.status)) return skip("not_open");
    if (lead.distributionStatus !== undefined && lead.distributionStatus !== "assigned") return skip("not_accepted");
    if (!lead.brokerId || (lead.assignmentSource && (AUTO_RULE_UNACCEPTED_SOURCES as readonly string[]).includes(lead.assignmentSource))) return skip("not_accepted");
  }
  if (milestone === "converted" && lead.status !== "converted") return skip("not_converted");
  if (milestone === "lost") {
    if (lead.status !== "lost") return skip("not_lost");
    if (isAutoRuleLossReasonExcluded(lead.lossTexts ?? [])) return skip("loss_reason");
  }
  const timing = autoRuleTiming({ milestoneAt: input.milestoneAt, delayBusinessDays: settings.delayBusinessDays, sendDay: input.sendDay });
  if (timing !== "due") return skip(timing);
  if (!matchesAutoRuleFilters(lead, settings.filters)) return skip("filters");
  if (!matchesAutoRulePilot(lead, settings.pilot)) return skip("not_in_pilot");
  if (settings.key === "R2" && input.lastR1AnswerAt && input.now.getTime() - input.lastR1AnswerAt.getTime() < AUTO_RULE_LIMITS.r2SkipIfR1AnsweredDays * 86_400_000) return skip("r1_answered");
  return { ok: true };
}

/** Rótulo curto para listas e relatório. */
export function postSaleRuleLabel(ruleKey: string | null | undefined) {
  if (!ruleKey) return "Manual";
  if (ruleKey === "R0") return "R0 Voltou a escrever";
  if (isAutoRuleKey(ruleKey)) return `${ruleKey} ${AUTO_RULE_DEFINITIONS[ruleKey].label}`;
  return ruleKey;
}

export type PostSaleRuleFilter = "all" | "manual" | "R0" | AutoRuleKey;

export const POST_SALE_RULE_FILTERS: readonly PostSaleRuleFilter[] = ["all", "manual", "R0", ...AUTO_RULE_KEYS];

export function parsePostSaleRuleFilter(value: unknown): PostSaleRuleFilter {
  return typeof value === "string" && (POST_SALE_RULE_FILTERS as readonly string[]).includes(value) ? value as PostSaleRuleFilter : "all";
}

export function matchesPostSaleRuleFilter(ruleKey: string | null | undefined, filter: PostSaleRuleFilter) {
  if (filter === "all") return true;
  if (filter === "manual") return !ruleKey;
  return ruleKey === filter;
}
