import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

export const quickReplyIntentValues = [
  "GREETING", "CONFIRMATION", "NEGATION", "THANKS", "GOODBYE", "WAITING_FOR_RESPONSE",
  "REQUEST_HUMAN", "HUMAN_ALREADY_CONTACTED", "REQUEST_CALLBACK", "URGENT_REQUEST",
  "NO_LONGER_INTERESTED", "OPT_OUT", "WRONG_NUMBER", "MEDIA_RECEIVED", "EMPTY_OR_UNCLEAR",
] as const;
export type QuickReplyIntent = (typeof quickReplyIntentValues)[number];

export const conversationAutomationStateValues = ["AI_ACTIVE", "WAITING_HUMAN", "HUMAN_IN_PROGRESS", "PAUSED", "CLOSED"] as const;
export type ConversationAutomationState = (typeof conversationAutomationStateValues)[number];

export const quickReplyMessageKindValues = ["text", "audio", "image", "document", "video", "sticker", "unknown"] as const;
export type QuickReplyMessageKind = (typeof quickReplyMessageKindValues)[number];

export const quickReplyTemplateSchema = z.object({
  ruleKey: z.string().trim().min(1).max(80),
  templateKey: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(1000),
  active: z.boolean().default(true),
});
export type QuickReplyTemplate = z.infer<typeof quickReplyTemplateSchema>;

export type QuickReplyRule = {
  key: string;
  intent: QuickReplyIntent;
  templateKey: string;
  priority: number;
  resolve: (input: QuickReplyInput) => boolean;
};

export type QuickReplyCooldown = {
  lastTemplateKey?: string | null;
  lastSentAt?: Date | null;
  waitWindowStartedAt?: Date | null;
  waitResponseCount: number;
  now?: Date;
};

export type QuickReplyInput = {
  body?: string | null;
  messageKind?: QuickReplyMessageKind;
  conversationState: ConversationAutomationState;
  isNewConversation: boolean;
  hasPriorMessages: boolean;
  hasPendingQuestion: boolean;
  cooldown?: QuickReplyCooldown;
  now?: Date;
};

export type QuickReplyResolution = {
  resolved: boolean;
  intent: QuickReplyIntent | null;
  ruleKey: string | null;
  templateKey: string | null;
  nextState?: ConversationAutomationState;
  notifyHuman: boolean;
  suppressReason?: "template_cooldown" | "wait_limit";
};

const defaultTemplates: Record<string, QuickReplyTemplate> = {
  "human.already_assigned": { ruleKey: "human.already_assigned", templateKey: "human.already_assigned", body: "Recebi sua mensagem. O corretor responsável já foi avisado e continuará seu atendimento por aqui.", active: true },
  "human.waiting_reminder": { ruleKey: "human.waiting_reminder", templateKey: "human.waiting_reminder", body: "Sua mensagem foi recebida. Reforcei o chamado para o corretor responsável.", active: true },
  "conversation.returning_lead": { ruleKey: "conversation.returning_lead", templateKey: "conversation.returning_lead", body: "Olá novamente. Vou avisar o corretor que acompanhou seu atendimento.", active: true },
  "greeting.initial": { ruleKey: "greeting.initial", templateKey: "greeting.initial", body: "Olá! Vou fazer algumas perguntas rápidas para preparar seu atendimento.", active: true },
  "human.requested": { ruleKey: "human.requested", templateKey: "human.requested", body: "Certo. Vou encaminhar seu atendimento para um corretor.", active: true },
  "opt_out.confirmed": { ruleKey: "opt_out.confirmed", templateKey: "opt_out.confirmed", body: "Entendido. Registrei sua solicitação e o atendimento automático será interrompido.", active: true },
  "wrong_number.confirmed": { ruleKey: "wrong_number.confirmed", templateKey: "wrong_number.confirmed", body: "Entendido. Vou interromper este atendimento e sinalizar o contato para a equipe.", active: true },
  "media.received": { ruleKey: "media.received", templateKey: "media.received", body: "Recebi o arquivo. O corretor responsável foi avisado para verificar.", active: true },
  "message.unclear": { ruleKey: "message.unclear", templateKey: "message.unclear", body: "Recebi sua mensagem. Se preferir, posso encaminhar seu atendimento para um corretor.", active: true },
  "callback.requested": { ruleKey: "callback.requested", templateKey: "callback.requested", body: "Certo. Vou avisar o corretor para retornar o contato assim que possível.", active: true },
  "urgent.requested": { ruleKey: "urgent.requested", templateKey: "urgent.requested", body: "Entendi a urgência. Vou sinalizar o corretor responsável agora.", active: true },
  "goodbye.confirmed": { ruleKey: "goodbye.confirmed", templateKey: "goodbye.confirmed", body: "Tudo bem. Quando precisar, estaremos por aqui.", active: true },
  "thanks.confirmed": { ruleKey: "thanks.confirmed", templateKey: "thanks.confirmed", body: "Por nada! O corretor continua Ã  disposição.", active: true },
};

export function normalizeQuickReplyText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBooleanReply(value: string | null | undefined): boolean | null {
  const text = normalizeQuickReplyText(value);
  if (/^(sim|s|yes|y|ok|okay|certo|isso|exato|pode|perfeito|confirmo|confirmado)$/.test(text)) return true;
  if (/^(nao|n|no|nem|negativo|cancelar|cancela)$/.test(text)) return false;
  return null;
}

export function parseGreeting(value: string | null | undefined) {
  const text = normalizeQuickReplyText(value);
  return /^(oi|ola|ola bom dia|bom dia|boa tarde|boa noite|hey|hello|tudo bem)$/.test(text);
}

export function parseThanks(value: string | null | undefined) {
  return /^(obrigad[oa]|valeu|agradeco|muito obrigado|muito obrigada|thanks|obg)$/.test(normalizeQuickReplyText(value));
}

export function parseHumanRequest(value: string | null | undefined) {
  const text = normalizeQuickReplyText(value);
  return /(falar|conversar|quero|preciso|chama|mande|manda|passa).{0,20}(atendente|corretor|humano|pessoa)/.test(text) || /^(atendente|corretor|humano|falar com atendente)$/.test(text);
}

export function parseOptOut(value: string | null | undefined) {
  const text = normalizeQuickReplyText(value);
  return /^(sair|parar|stop|nao quero mais|nao me mande|remover|descadastrar|cancelar mensagens|pare de enviar|pare de enviar mensagens|nao tenho interesse|sem interesse)$/.test(text) || /(nao tenho interesse|sem interesse|nao quero|nao tenho mais interesse|ja contratei|ja tenho|nao solicitei|nao pedi)/.test(text);
}

export function parseStartQualification(value: string | null | undefined) {
  const text = normalizeQuickReplyText(value);
  return /^(iniciar atendimento|iniciar|iniciar qualificacao|comecar|vamos la|quero iniciar)$/.test(text);
}

export function parseWrongNumber(value: string | null | undefined) {
  return /(numero errado|pessoa errada|nao conheco|nao sou|contato errado|engano)/.test(normalizeQuickReplyText(value));
}

function isWaiting(text: string) {
  return /(aguardando|ainda nao|sem retorno|quando vao|cadê|cade|tem alguma novidade|me responde)/.test(text);
}

function isCallback(text: string) {
  return /(me liga|ligue|ligar|retornar|retorno|pode me chamar)/.test(text);
}

function isUrgent(text: string) {
  return /(urgente|urgencia|emergencia|o quanto antes|agora)/.test(text);
}

function isGoodbye(text: string) {
  return /^(tchau|ate mais|ate logo|falou|bom fim de semana|vou pensar)$/.test(text);
}

export const quickReplyRules: QuickReplyRule[] = [
  { key: "opt_out", intent: "OPT_OUT", templateKey: "opt_out.confirmed", priority: 100, resolve: (input) => parseOptOut(input.body) },
  { key: "wrong_number", intent: "WRONG_NUMBER", templateKey: "wrong_number.confirmed", priority: 95, resolve: (input) => parseWrongNumber(input.body) },
  { key: "request_human", intent: "REQUEST_HUMAN", templateKey: "human.requested", priority: 90, resolve: (input) => parseHumanRequest(input.body) },
  { key: "media_received", intent: "MEDIA_RECEIVED", templateKey: "media.received", priority: 85, resolve: (input) => input.messageKind !== "text" && input.messageKind !== undefined },
  { key: "human_already_contacted", intent: "HUMAN_ALREADY_CONTACTED", templateKey: "human.already_assigned", priority: 80, resolve: (input) => input.conversationState === "HUMAN_IN_PROGRESS" },
  { key: "waiting_human", intent: "WAITING_FOR_RESPONSE", templateKey: "human.waiting_reminder", priority: 75, resolve: (input) => input.conversationState === "WAITING_HUMAN" },
  { key: "waiting_response", intent: "WAITING_FOR_RESPONSE", templateKey: "human.waiting_reminder", priority: 74, resolve: (input) => isWaiting(normalizeQuickReplyText(input.body)) },
  { key: "urgent", intent: "URGENT_REQUEST", templateKey: "urgent.requested", priority: 70, resolve: (input) => isUrgent(normalizeQuickReplyText(input.body)) },
  { key: "callback", intent: "REQUEST_CALLBACK", templateKey: "callback.requested", priority: 65, resolve: (input) => isCallback(normalizeQuickReplyText(input.body)) },
  // During AI qualification, greetings and short confirmations can be the
  // customer's answer to the persisted question. They must reach extraction
  // and the next-field resolver, never replace the flow with a generic reply.
  { key: "thanks", intent: "THANKS", templateKey: "thanks.confirmed", priority: 50, resolve: (input) => !input.hasPendingQuestion && input.conversationState !== "AI_ACTIVE" && parseThanks(input.body) },
  { key: "goodbye", intent: "GOODBYE", templateKey: "goodbye.confirmed", priority: 45, resolve: (input) => !input.hasPendingQuestion && input.conversationState !== "AI_ACTIVE" && isGoodbye(normalizeQuickReplyText(input.body)) },
  { key: "empty_or_unclear", intent: "EMPTY_OR_UNCLEAR", templateKey: "message.unclear", priority: 1, resolve: (input) => normalizeQuickReplyText(input.body).length === 0 },
];

function isWithin(date: Date | null | undefined, ms: number, now: Date) {
  return Boolean(date && now.getTime() - date.getTime() < ms);
}

export function isQuickReplySuppressed(input: { templateKey: string; ruleKey: string; cooldown?: QuickReplyCooldown; now?: Date }) {
  const now = input.now ?? new Date();
  const cooldown = input.cooldown;
  if (!cooldown) return undefined;
  if (cooldown.lastTemplateKey === input.templateKey && isWithin(cooldown.lastSentAt, 10 * 60 * 1000, now)) return "template_cooldown" as const;
  if (input.ruleKey === "waiting_human" || input.ruleKey === "waiting_response") {
    const count = isWithin(cooldown.waitWindowStartedAt, 30 * 60 * 1000, now) ? cooldown.waitResponseCount : 0;
    if (count >= 2) return "wait_limit" as const;
  }
  return undefined;
}

export function resolveQuickReply(input: QuickReplyInput): QuickReplyResolution {
  if (parseStartQualification(input.body)) {
    return { resolved: false, intent: "GREETING", ruleKey: "start_qualification", templateKey: null, nextState: "AI_ACTIVE", notifyHuman: false };
  }
  const rule = [...quickReplyRules].sort((a, b) => b.priority - a.priority).find((candidate) => candidate.resolve(input));
  if (!rule) return { resolved: false, intent: null, ruleKey: null, templateKey: null, notifyHuman: false };
  const suppressed = isQuickReplySuppressed({ templateKey: rule.templateKey, ruleKey: rule.key, cooldown: input.cooldown, now: input.now });
  if (suppressed) return { resolved: true, intent: rule.intent, ruleKey: rule.key, templateKey: rule.templateKey, notifyHuman: rule.intent !== "GREETING", suppressReason: suppressed };
  let nextState: ConversationAutomationState | undefined;
  if (rule.intent === "OPT_OUT" || rule.intent === "WRONG_NUMBER") nextState = "PAUSED";
  else if (rule.intent === "REQUEST_HUMAN") nextState = "WAITING_HUMAN";
  else if (rule.intent === "GREETING") nextState = "AI_ACTIVE";
  return { resolved: true, intent: rule.intent, ruleKey: rule.key, templateKey: rule.templateKey, nextState, notifyHuman: rule.intent === "REQUEST_HUMAN" || rule.intent === "WAITING_FOR_RESPONSE" || rule.intent === "MEDIA_RECEIVED" || rule.intent === "URGENT_REQUEST" || rule.intent === "REQUEST_CALLBACK" || rule.intent === "HUMAN_ALREADY_CONTACTED" || rule.intent === "WRONG_NUMBER" };
}

export function getDefaultQuickReplyTemplates(): Record<string, QuickReplyTemplate> {
  return {
    ...defaultTemplates,
    "human.already_assigned": { ruleKey: "human.already_assigned", templateKey: "human.already_assigned", body: "Recebi sua mensagem. O corretor respons\u00e1vel j\u00e1 foi avisado e continuar\u00e1 seu atendimento por aqui.", active: true },
    "human.waiting_reminder": { ruleKey: "human.waiting_reminder", templateKey: "human.waiting_reminder", body: "Sua mensagem foi recebida. Reforcei o chamado para o corretor respons\u00e1vel.", active: true },
    "conversation.returning_lead": { ruleKey: "conversation.returning_lead", templateKey: "conversation.returning_lead", body: "Ol\u00e1 novamente. Vou avisar o corretor que acompanhou seu atendimento.", active: true },
    "greeting.initial": { ruleKey: "greeting.initial", templateKey: "greeting.initial", body: "Ol\u00e1! Vou fazer algumas perguntas r\u00e1pidas para preparar seu atendimento.", active: true },
    "human.requested": { ruleKey: "human.requested", templateKey: "human.requested", body: "Certo! Estou transferindo seu atendimento para a fila de um corretor especialista agora mesmo. Para agilizar seu atendimento, pode me informar seu nome e para quantas pessoas busca o plano?", active: true },
    "opt_out.confirmed": { ruleKey: "opt_out.confirmed", templateKey: "opt_out.confirmed", body: "Entendido. Registrei sua solicita\u00e7\u00e3o e o atendimento autom\u00e1tico ser\u00e1 interrompido.", active: true },
    "wrong_number.confirmed": { ruleKey: "wrong_number.confirmed", templateKey: "wrong_number.confirmed", body: "Entendido. Vou interromper este atendimento e sinalizar o contato para a equipe.", active: true },
    "media.received": { ruleKey: "media.received", templateKey: "media.received", body: "Recebi o arquivo. O corretor respons\u00e1vel foi avisado para verificar.", active: true },
    "message.unclear": { ruleKey: "message.unclear", templateKey: "message.unclear", body: "Recebi sua mensagem. Se preferir, posso encaminhar seu atendimento para um corretor.", active: true },
    "callback.requested": { ruleKey: "callback.requested", templateKey: "callback.requested", body: "Certo. Vou avisar o corretor para retornar o contato assim que poss\u00edvel.", active: true },
    "urgent.requested": { ruleKey: "urgent.requested", templateKey: "urgent.requested", body: "Entendi a urg\u00eancia. Vou sinalizar o corretor respons\u00e1vel agora.", active: true },
    "goodbye.confirmed": { ruleKey: "goodbye.confirmed", templateKey: "goodbye.confirmed", body: "Tudo bem. Quando precisar, estaremos por aqui.", active: true },
    "thanks.confirmed": { ruleKey: "thanks.confirmed", templateKey: "thanks.confirmed", body: "Por nada! O corretor continua \u00e0 disposi\u00e7\u00e3o.", active: true },
  };
}

export async function loadQuickReplyTemplates(tenantId: string) {
  const rows = await getDatabase().select({ ruleKey: schema.aiQuickReplyTemplates.ruleKey, templateKey: schema.aiQuickReplyTemplates.templateKey, body: schema.aiQuickReplyTemplates.body, active: schema.aiQuickReplyTemplates.active }).from(schema.aiQuickReplyTemplates).where(and(eq(schema.aiQuickReplyTemplates.tenantId, tenantId), eq(schema.aiQuickReplyTemplates.active, true)));
  const templates = getDefaultQuickReplyTemplates();
  for (const row of rows) templates[row.ruleKey] = { ruleKey: row.ruleKey, templateKey: row.templateKey, body: row.body, active: row.active };
  return templates;
}
