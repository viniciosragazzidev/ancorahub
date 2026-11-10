import { saoPauloHour } from "@/features/qualification-turbo/approaches";

/**
 * One light follow-up when the customer stops answering in the middle of the AI qualification (10/11, case
 * Andréia: the AI asked the ages at 14:48 and nothing came back until the lead turned cold). Pure rules; the
 * sweep in silence-follow-up.ts loads the data and sends. Plan:
 * docs/implementations/active/2026-11-10-followup-silencio-qualificacao.md
 */

export type SilenceFollowUpChannel = "meta" | "waha";
export type SilenceFollowUpChannelSetting = "same" | SilenceFollowUpChannel;

/** Fixed id per lead: at most one follow-up, and two overlapping runs cannot both send it. */
export const SILENCE_FOLLOW_UP_ID_PREFIX = "ai_silence_followup_";
export function silenceFollowUpMessageId(leadId: string) {
  return `${SILENCE_FOLLOW_UP_ID_PREFIX}${leadId}`;
}

/** Sends from 8h until 21h (São Paulo), every day. */
const SEND_START_HOUR = 8;
const SEND_END_HOUR = 21;
/** Never closer than this to the timeout: the cold sweep owns that boundary. */
const TIMEOUT_MARGIN_MINUTES = 2;
const MIN_DELAY_MINUTES = 5;
/** Meta only accepts free text within 24h of the customer's last message. */
const META_SERVICE_WINDOW_MS = 24 * 60 * 60_000;

/** Silence that triggers the follow-up: half the tenant timeout, at least 5 min. Null when there is no room. */
export function silenceFollowUpWindow(timeoutMinutes: number | null | undefined) {
  const timeout = Math.max(1, Math.floor(typeof timeoutMinutes === "number" && Number.isFinite(timeoutMinutes) ? timeoutMinutes : 15));
  const delay = Math.max(MIN_DELAY_MINUTES, Math.floor(timeout / 2));
  const latest = timeout - TIMEOUT_MARGIN_MINUTES;
  return delay < latest ? { delayMinutes: delay, latestMinutes: latest } : null;
}

export type SilenceMessage = {
  id: string;
  direction: string;
  senderRole: string | null;
  body: string | null;
  provider: string | null;
  providerStatus: string | null;
  sentAt: Date;
};

export type SilenceFollowUpInput = {
  now: Date;
  enabled: boolean;
  channelSetting: SilenceFollowUpChannelSetting;
  timeoutMinutes: number | null | undefined;
  leadName: string | null;
  lead: {
    corretorId: string | null;
    status: string;
    qualificationStatus: string | null;
    distributionStatus: string | null;
    distributionRemovedAt: Date | null;
    deletedAt: Date | null;
    archivedAt: Date | null;
  };
  conversation: {
    status: string;
    automationState: string | null;
    optOutAt: Date | null;
    wrongNumberAt: Date | null;
  } | null;
  /** Any order. */
  messages: readonly SilenceMessage[];
  /** The lead has a WAHA cadence run the reply can go through. */
  wahaAvailable: boolean;
};

export type SilenceFollowUpSkipReason =
  | "disabled"
  | "no_room"
  | "already_sent"
  | "lead_closed"
  | "assigned_to_broker"
  | "not_qualifying"
  | "held"
  | "no_conversation"
  | "ai_not_active"
  | "opted_out"
  | "customer_replied"
  | "last_not_ai_question"
  | "never_replied"
  | "too_early"
  | "too_late"
  | "outside_hours"
  | "no_channel";

export type SilenceFollowUpDecision =
  | { action: "send"; channel: SilenceFollowUpChannel; fallback: SilenceFollowUpChannel | null; text: string }
  | { action: "skip"; reason: SilenceFollowUpSkipReason };

const QUALIFYING = new Set(["pending", "qualifying"]);
const AI_CONVERSATION = new Set(["AI_ACTIVE", "WAITING_CUSTOMER"]);
const CLOSED_LEAD = new Set(["lost", "converted"]);

const isInbound = (message: SilenceMessage) => message.direction === "incoming" || message.direction === "inbound";
const isOutbound = (message: SilenceMessage) => message.direction === "outbound" || message.direction === "outgoing";
const isMetaProvider = (provider: string | null) => !provider || provider === "meta" || provider === "meta_cloud";

function channelOf(message: SilenceMessage): SilenceFollowUpChannel {
  return message.provider === "waha" ? "waha" : "meta";
}

export function decideSilenceFollowUp(input: SilenceFollowUpInput): SilenceFollowUpDecision {
  const skip = (reason: SilenceFollowUpSkipReason) => ({ action: "skip" as const, reason });
  if (!input.enabled) return skip("disabled");
  const window = silenceFollowUpWindow(input.timeoutMinutes);
  if (!window) return skip("no_room");
  const messages = [...input.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  if (messages.some((message) => message.id.startsWith(SILENCE_FOLLOW_UP_ID_PREFIX))) return skip("already_sent");

  const { lead, conversation } = input;
  if (lead.deletedAt || lead.archivedAt || CLOSED_LEAD.has(lead.status)) return skip("lead_closed");
  if (lead.corretorId) return skip("assigned_to_broker");
  if (!QUALIFYING.has(lead.qualificationStatus ?? "pending")) return skip("not_qualifying");
  if (lead.distributionStatus === "manual_hold" || lead.distributionRemovedAt) return skip("held");
  if (!conversation) return skip("no_conversation");
  if (conversation.optOutAt || conversation.wrongNumberAt) return skip("opted_out");
  if (!AI_CONVERSATION.has(conversation.status) || (conversation.automationState ?? "AI_ACTIVE") !== "AI_ACTIVE") return skip("ai_not_active");

  const delivered = messages.filter((message) => !(isOutbound(message) && message.providerStatus === "failed"));
  const last = delivered[delivered.length - 1];
  if (!last) return skip("never_replied");
  if (isInbound(last)) return skip("customer_replied");
  if (!isOutbound(last) || last.senderRole !== "assistant" || !(last.body ?? "").includes("?")) return skip("last_not_ai_question");
  // A lead that never answered is the turbo cadence's job (templates T1 to T4).
  const inbound = delivered.filter(isInbound);
  if (!inbound.length) return skip("never_replied");

  const silentMinutes = (input.now.getTime() - last.sentAt.getTime()) / 60_000;
  if (silentMinutes < window.delayMinutes) return skip("too_early");
  if (silentMinutes >= window.latestMinutes) return skip("too_late");
  const hour = saoPauloHour(input.now);
  if (hour < SEND_START_HOUR || hour >= SEND_END_HOUR) return skip("outside_hours");

  const lastMetaInbound = [...inbound].reverse().find((message) => isMetaProvider(message.provider));
  const valid: Record<SilenceFollowUpChannel, boolean> = {
    meta: Boolean(lastMetaInbound && input.now.getTime() - lastMetaInbound.sentAt.getTime() < META_SERVICE_WINDOW_MS),
    waha: input.wahaAvailable,
  };
  const primary = input.channelSetting === "same" ? channelOf(last) : input.channelSetting;
  const other: SilenceFollowUpChannel = primary === "meta" ? "waha" : "meta";
  const candidates = (input.channelSetting === "same" ? [primary, other] : [primary]).filter((channel) => valid[channel]);
  if (!candidates.length) return skip("no_channel");
  return { action: "send", channel: candidates[0], fallback: candidates[1] ?? null, text: buildSilenceFollowUpText(last.body ?? "", input.leadName) };
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** The question the AI asked last: the last paragraph with "?" of its message. */
function lastQuestion(body: string) {
  const parts = body.split(/\n+/).map((part) => part.trim()).filter((part) => part.includes("?"));
  return parts[parts.length - 1] ?? body;
}

const TOPICS: Array<{ match: RegExp; ask: string; then: string }> = [
  { match: /e-?mail/, ask: "me passar o seu e-mail", then: "Assim eu já te envio a cotação." },
  { match: /cnpj/, ask: "me confirmar se a empresa tem CNPJ", then: "Assim eu já sigo com a sua cotação agora mesmo." },
  { match: /plano de saude hoje|ja (tem|tenho|possui)\w* (algum )?plano/, ask: "me dizer se você já tem plano de saúde hoje", then: "Assim eu já sigo com a sua cotação agora mesmo." },
  { match: /\bidades?\b|\banos\b/, ask: "me dizer a idade de quem vai usar o plano", then: "Assim eu já calculo pra você agora mesmo." },
  { match: /quantas (pessoas|vidas)|quantas? sao|vidas/, ask: "me dizer quantas pessoas vão entrar no plano", then: "Assim eu já sigo com a sua cotação agora mesmo." },
  { match: /cidade|bairro|regiao|onde (voce |voces )?mora/, ask: "me dizer em qual cidade e bairro você mora", then: "Assim eu já vejo as opções da sua região agora mesmo." },
  { match: /familia|empresa|individual|so (seu|sua|pra voce|para voce)|tipo de plano/, ask: "me dizer se o plano é só pra você, pra família ou pra empresa", then: "Assim eu já sigo com a sua cotação agora mesmo." },
  { match: /nome/, ask: "me dizer o seu nome completo", then: "Assim eu já sigo com a sua cotação agora mesmo." },
];

function firstNameOf(name: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}]{2,20}$/u.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
}

/** Short and friendly, resuming the AI's last question by its subject. */
export function buildSilenceFollowUpText(lastAiMessage: string, leadName: string | null) {
  const question = normalize(lastQuestion(lastAiMessage));
  const topic = TOPICS.find((item) => item.match.test(question));
  const sentence = topic ? `consegue ${topic.ask}? ${topic.then}` : "consegue me responder a pergunta acima? Assim eu já te ajudo agora mesmo.";
  const name = firstNameOf(leadName);
  return name ? `${name}, ${sentence}` : sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
