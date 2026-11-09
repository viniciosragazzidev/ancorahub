import { z } from "zod";

/**
 * Regra R0 do pós-venda (plano 2026-11-06): cliente que volta a escrever depois de distribuído.
 * Regras puras, sem I/O: quando a conversa dispara, como a resposta do cliente é classificada,
 * o que a IA responde e quando a direção recebe a escalada. Pedido de 09/11: a R0 não avisa o
 * corretor por nenhum caminho; quem recebe alertas é a direção e o gestor da unidade.
 */

export const R0_RULE_KEY = "R0";

export const R0_DEFAULTS = {
  /** Minutos úteis sem resposta humana até a IA puxar a conversa. */
  waitMinutes: 10,
  /** O corretor respondeu há menos disso: a R0 não entra. */
  brokerRecentReplyHours: 2,
  /** No máximo uma conversa R0 por lead nesse intervalo. */
  cooldownDays: 7,
  /** Minutos úteis, depois da resposta do cliente, para alguém da empresa retomar antes da escalada. */
  escalationMinutes: 15,
  /** A mensagem do cliente precisa estar dentro da janela de 24 h do Meta (margem de 1 h). */
  maxCustomerMessageAgeHours: 23,
} as const;

/** Etapas em que o lead está com o corretor e ainda em negociação (sem Documentação, Em análise, vendido ou perdido). */
export const R0_ELIGIBLE_STATUSES = ["distributed", "in_contact", "quote_sent", "negotiation", "awaiting_reply"] as const;

export type R0Settings = { enabled: boolean; queueIds: string[] };

export const R0_SETTINGS_DEFAULT: R0Settings = { enabled: false, queueIds: [] };

const r0SettingsSchema = z.object({
  enabled: z.boolean().default(false),
  queueIds: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

/** Chave em system_settings, por empresa. Ausente ou inválida = desligada. */
export function postSaleR0SettingKey(tenantId: string) {
  return `post_sale_r0_${tenantId}`;
}

export function parseR0Settings(raw: string | null | undefined): R0Settings {
  if (!raw) return { ...R0_SETTINGS_DEFAULT };
  try {
    const parsed = r0SettingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ...R0_SETTINGS_DEFAULT };
    return { enabled: parsed.data.enabled, queueIds: [...new Set(parsed.data.queueIds)] };
  } catch {
    return { ...R0_SETTINGS_DEFAULT };
  }
}

export function serializeR0Settings(settings: R0Settings) {
  return JSON.stringify({ enabled: settings.enabled, queueIds: [...new Set(settings.queueIds)] });
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

/** "Encerrando o atendimento", "vou encerrar por aqui", "atendimento finalizado". */
export function isAttendanceClosingMessage(body: string | null | undefined) {
  const text = normalize(body);
  return /\b(encerr\w*|finaliz\w*)\b.*\batendimento\b|\batendimento\b.*\b(encerrad\w*|finalizad\w*)\b|\bvou encerrar\b/.test(text);
}

export type R0SkipReason =
  | "disabled"
  | "queue_not_in_pilot"
  | "status"
  | "not_accepted"
  | "director_owner"
  | "not_waiting"
  | "opted_out"
  | "active_survey"
  | "cooldown"
  | "broker_recent_reply"
  | "too_soon"
  | "outside_business_hours"
  | "window_closed"
  | "source_unavailable";

export type R0TriggerInput = {
  settings: R0Settings;
  lead: {
    status: string;
    distributionStatus: string;
    queueId: string | null;
    brokerId: string | null;
    /** Papel do dono do lead na empresa (director, manager, broker...). */
    ownerRole: string | null;
  };
  /** Ciclo aberto do "cliente aguardando corretor" (null quando ninguém espera). */
  waiting: { waitingBusinessMinutes: number; lastCustomerMessageAt: string } | null;
  /** Última mensagem de uma pessoa da empresa para o cliente, antes da espera. */
  lastHumanReply: { at: Date; body: string | null } | null;
  now: Date;
  withinBusinessHours: boolean;
  activeSurvey: boolean;
  optedOut: boolean;
  lastR0At: Date | null;
  sourceAvailable: boolean;
};

export type R0TriggerDecision =
  | { fire: true; reason: "no_reply" | "after_closing" }
  | { fire: false; skip: R0SkipReason };

const HOUR_MS = 3_600_000;

export function decideR0Trigger(input: R0TriggerInput): R0TriggerDecision {
  const skip = (reason: R0SkipReason): R0TriggerDecision => ({ fire: false, skip: reason });
  if (!input.settings.enabled) return skip("disabled");
  if (!input.lead.queueId || !input.settings.queueIds.includes(input.lead.queueId)) return skip("queue_not_in_pilot");
  if (!(R0_ELIGIBLE_STATUSES as readonly string[]).includes(input.lead.status)) return skip("status");
  if (!input.lead.brokerId || input.lead.distributionStatus !== "assigned") return skip("not_accepted");
  if (input.lead.ownerRole === "director") return skip("director_owner");
  if (!input.waiting) return skip("not_waiting");
  if (input.optedOut) return skip("opted_out");
  if (input.activeSurvey) return skip("active_survey");
  if (input.lastR0At && input.now.getTime() - input.lastR0At.getTime() < R0_DEFAULTS.cooldownDays * 24 * HOUR_MS) return skip("cooldown");
  const afterClosing = Boolean(input.lastHumanReply && isAttendanceClosingMessage(input.lastHumanReply.body));
  if (!afterClosing && input.lastHumanReply && input.now.getTime() - input.lastHumanReply.at.getTime() < R0_DEFAULTS.brokerRecentReplyHours * HOUR_MS) return skip("broker_recent_reply");
  if (!afterClosing && input.waiting.waitingBusinessMinutes < R0_DEFAULTS.waitMinutes) return skip("too_soon");
  if (!input.withinBusinessHours) return skip("outside_business_hours");
  const customerAt = Date.parse(input.waiting.lastCustomerMessageAt);
  if (!Number.isFinite(customerAt) || input.now.getTime() - customerAt > R0_DEFAULTS.maxCustomerMessageAgeHours * HOUR_MS) return skip("window_closed");
  if (!input.sourceAvailable) return skip("source_unavailable");
  return { fire: true, reason: afterClosing ? "after_closing" : "no_reply" };
}

/** Abertura da R0, em texto livre (no Meta, dentro da janela aberta pelo cliente). */
export function renderR0Opening(input: { lead: string; broker: string; assistant: string; company: string; leadType: string | null }) {
  const plan = input.leadType === "PJ" ? "o plano empresarial" : "o plano de saúde";
  return `Oi, ${input.lead}! Aqui é a ${input.assistant}, da equipe de qualidade da ${input.company}. Vi que você já conversou com ${input.broker} sobre ${plan}. Me conta o que rolou: você chegou a ser atendido e recebeu a cotação?`;
}

export const R0_CATEGORIES = ["not_attended", "wants_more", "closed_or_gave_up", "other_subject"] as const;
export type R0Category = (typeof R0_CATEGORIES)[number];

export const r0AnswerSchema = z.object({
  category: z.enum(R0_CATEGORIES),
  closedKind: z.enum(["closed_elsewhere", "gave_up", "unknown"]).nullable().optional(),
  request: z.string().max(160).nullable().optional(),
  reason: z.string().max(300).nullable().optional(),
  optOut: z.boolean().optional(),
});

export type R0Answer = z.infer<typeof r0AnswerSchema>;

const R0_OPT_OUT = /\b(pare de|parar de|para de me|nao me (chame|mande|envie|procure)|remova|me tira (da|dessa)|nao quero (mais )?receber)\b/;
const R0_CLOSED = /\b(ja fechei|fechei|fechamos|contratei|contratamos|ja contratei|ja tenho (um )?plano|fiz com outr\w*|fechei com outr\w*|ja resolvi)\b/;
const R0_GAVE_UP = /\b(desisti|desistimos|nao (tenho|tenho mais) interesse|sem interesse|nao quero mais|nao vou (mais )?(fazer|contratar)|deixa pra la|ficou caro|muito caro)\b/;
const R0_NOT_ATTENDED = /\b(nao (fui|fomos) atendid\w*|ninguem (me )?(atendeu|respondeu|chamou|retornou|ligou)|nao (recebi|chegou|mandaram|enviaram)\b.*\b(cotacao|proposta|valor\w*|orcamento)|nao me (responderam|retornaram|atenderam|mandaram|chamaram)|sem resposta|nao tive (nenhum )?retorno|nao falei com|nao consegui falar|ainda nao)\b/;
const R0_WANTS_MORE = /\b(cotacao|proposta|valor\w*|preco\w*|orcamento|ajust\w*|duvida\w*|outra opcao|outras opcoes|nova|novo|mudar|incluir|alterar|refazer|quero|gostaria|preciso|pode me (mandar|passar|enviar))\b/;
const SIMPLE_NO = /^(nao|n|nao recebi|nao fui|nada|nenhum|nenhuma)$/;
const SIMPLE_YES = /^(sim|s|recebi|fui|fui sim|sim recebi|ja|claro)$/;

/** Classificação por palavras-chave, usada quando a IA falha. */
export function classifyR0AnswerByKeywords(text: string): R0Answer {
  const value = normalize(text);
  const optOut = R0_OPT_OUT.test(value);
  if (R0_CLOSED.test(value)) return { category: "closed_or_gave_up", closedKind: "closed_elsewhere", request: null, reason: text.trim().slice(0, 300) || null, optOut };
  if (R0_GAVE_UP.test(value)) return { category: "closed_or_gave_up", closedKind: "gave_up", request: null, reason: text.trim().slice(0, 300) || null, optOut };
  if (SIMPLE_NO.test(value) || R0_NOT_ATTENDED.test(value)) return { category: "not_attended", closedKind: null, request: null, reason: null, optOut };
  if (SIMPLE_YES.test(value) || R0_WANTS_MORE.test(value)) return { category: "wants_more", closedKind: null, request: text.trim().slice(0, 160) || null, reason: null, optOut };
  return { category: "other_subject", closedKind: null, request: text.trim().slice(0, 160) || null, reason: null, optOut };
}

export type R0Outcome = "r0_not_attended" | "r0_wants_more" | "r0_closed_elsewhere" | "r0_gave_up" | "r0_other";

export const R0_OUTCOME_LABELS: Record<R0Outcome, string> = {
  r0_not_attended: "Voltou a escrever: diz que não foi atendido",
  r0_wants_more: "Voltou a escrever: quer cotação nova, ajuste ou tirar dúvida",
  r0_closed_elsewhere: "Voltou a escrever: já fechou",
  r0_gave_up: "Voltou a escrever: desistiu",
  r0_other: "Voltou a escrever: outro assunto",
};

export function isR0Outcome(value: string | null | undefined): value is R0Outcome {
  return Boolean(value && value in R0_OUTCOME_LABELS);
}

export type R0Turn = {
  status: "completed" | "opted_out";
  outcome: R0Outcome | "other";
  text: string;
  /** Alguém da empresa precisa retomar a conversa; sem isso em 15 min úteis, a direção recebe a escalada. */
  awaitsTeam: boolean;
};

/**
 * Destino da resposta. A IA nunca informa preço e nunca promete o retorno de um corretor
 * específico: fala só em "a equipe". Nenhum caminho avisa o corretor (pedido de 09/11).
 */
export function r0NextTurn(answer: R0Answer, names: { lead: string }): R0Turn {
  if (answer.optOut) return { status: "opted_out", outcome: "other", awaitsTeam: false, text: "Tudo bem. Obrigada por avisar. Não vamos mais enviar mensagens de pesquisa." };
  switch (answer.category) {
    case "not_attended":
      return { status: "completed", outcome: "r0_not_attended", awaitsTeam: true, text: `Poxa, ${names.lead}, sinto muito por isso. Já avisei a nossa equipe e alguém vai retomar seu atendimento por aqui o quanto antes.` };
    case "wants_more":
      return { status: "completed", outcome: "r0_wants_more", awaitsTeam: true, text: `Perfeito, ${names.lead}! Anotei o seu pedido e a equipe vai retomar seu atendimento por aqui em breve.` };
    case "closed_or_gave_up":
      return answer.closedKind === "gave_up"
        ? { status: "completed", outcome: "r0_gave_up", awaitsTeam: false, text: `Entendi, ${names.lead}. Obrigada por me contar. Se mudar de ideia, é só chamar por aqui.` }
        : { status: "completed", outcome: "r0_closed_elsewhere", awaitsTeam: false, text: `Que bom que você já resolveu, ${names.lead}! Obrigada por avisar. Se precisar de algo, é só chamar por aqui.` };
    default:
      return { status: "completed", outcome: "r0_other", awaitsTeam: true, text: `Obrigada, ${names.lead}! Já registrei sua mensagem e a equipe vai te responder por aqui em breve.` };
  }
}

/** Texto curto para a linha do tempo do lead. */
export function r0TimelineSummary(input: { outcome: R0Outcome | "other"; answer: R0Answer; trigger: "no_reply" | "after_closing" | null }) {
  const head = input.trigger === "after_closing"
    ? "Pós-venda R0: o cliente voltou a escrever depois de o atendimento ser encerrado."
    : "Pós-venda R0: o cliente voltou a escrever e ficou sem resposta.";
  const outcome = isR0Outcome(input.outcome) ? `${R0_OUTCOME_LABELS[input.outcome]}.` : "Pediu para não receber mensagens.";
  const request = input.answer.request ? `Pedido: ${input.answer.request.slice(0, 160)}.` : null;
  const reason = input.answer.reason ? `Motivo: ${input.answer.reason.slice(0, 180)}.` : null;
  return [head, outcome, request, reason].filter(Boolean).join(" ").slice(0, 900);
}

export type R0EscalationState = "wait" | "resolved" | "escalate";

/**
 * Depois da resposta do cliente: alguém da empresa respondeu (resolvido) ou passaram os
 * minutos úteis do prazo sem resposta (escala para a direção).
 */
export function r0EscalationState(input: { answeredAt: Date; humanReplyAt: Date | null; businessMsSinceAnswer: number; escalationMinutes?: number }): R0EscalationState {
  if (input.humanReplyAt && input.humanReplyAt.getTime() > input.answeredAt.getTime()) return "resolved";
  return input.businessMsSinceAnswer >= (input.escalationMinutes ?? R0_DEFAULTS.escalationMinutes) * 60_000 ? "escalate" : "wait";
}

/** Estado da R0 guardado em `post_sale_surveys.answers.r0`. */
export type R0SurveyState = {
  trigger?: "no_reply" | "after_closing";
  triggerMessageId?: string;
  category?: R0Category;
  closedKind?: "closed_elsewhere" | "gave_up" | "unknown" | null;
  request?: string | null;
  reason?: string | null;
  answeredAt?: string;
  awaitsTeam?: boolean;
  resolvedAt?: string;
  escalatedAt?: string;
};

export function readR0State(answers: unknown): R0SurveyState {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  const value = (answers as Record<string, unknown>).r0;
  return value && typeof value === "object" && !Array.isArray(value) ? value as R0SurveyState : {};
}
