import { addBusinessMilliseconds, businessMillisecondsBetween, isWithinBusinessHours } from "@/shared/time/business-hours";

/**
 * Cliente aguardando o corretor (plano 2026-11-04). Pure rules: from the lead's messages, is the customer waiting
 * for a person of the company, since when, and which step of the ladder (AI acknowledgement and first charge,
 * second charge, reassignment) the wait has reached. Times count only in business hours.
 */

export type CustomerWaitingStage = "watching" | "acknowledge" | "second_charge" | "reassign";

export type CustomerWaitingPolicy = {
  acknowledgeMinutes: number;
  secondChargeMinutes: number;
  reassignMinutes: number;
};

/** Defaults approved on 04/11/2026: 15 min, 45 min and 2 h of business time. */
export const DEFAULT_CUSTOMER_WAITING_POLICY: CustomerWaitingPolicy = {
  acknowledgeMinutes: 15,
  secondChargeMinutes: 45,
  reassignMinutes: 120,
};

export const META_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CustomerWaitingMessage = {
  direction: string;
  senderRole: string | null;
  body: string | null;
  mediaKind: string | null;
  sentAt: Date | string;
};

export type CustomerWaitingAssessment = {
  /** First customer message that still has no answer from a person. */
  cycleStartedAt: string;
  /** The broker is only accountable from the assignment on. */
  clockStartedAt: string;
  lastCustomerMessageAt: string;
  unansweredCount: number;
  waitingBusinessMinutes: number;
  stage: CustomerWaitingStage;
  nextStage: Exclude<CustomerWaitingStage, "watching"> | null;
  nextStageAt: string | null;
  urgent: boolean;
  /** The customer's own words for the charge: the most telling unanswered message. */
  customerQuote: string | null;
  metaWindowOpen: boolean;
  outsideBusinessHours: boolean;
  /** The AI wrote after the customer's last message (e.g. finishing the qualification): no AI acknowledgement is needed, only the broker. */
  aiRepliedLast: boolean;
};

const STAGE_ORDER: Array<Exclude<CustomerWaitingStage, "watching">> = ["acknowledge", "second_charge", "reassign"];

function time(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
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

/** Short closings that do not ask for anything ("ok", "obrigado", "valeu", a thumbs up). */
const ACKNOWLEDGEMENTS = new Set([
  "ok", "okay", "oks", "okk", "blz", "beleza", "certo", "ta", "ta bom", "ta certo", "tudo bem", "perfeito", "show", "top",
  "obrigado", "obrigada", "obg", "brigado", "brigada", "valeu", "vlw", "grato", "grata", "de nada", "combinado",
  "ok obrigado", "ok obrigada", "obrigado ok", "ta bom obrigado", "ta bom obrigada", "certo obrigado", "certo obrigada",
  "sim", "aguardo", "fico no aguardo", "entendi",
]);

const NO_REPLY_MEDIA = new Set(["sticker", "reaction"]);

/** The customer says the conversation already happens elsewhere ("já estou falando aqui com o corretor"). */
const ALREADY_ATTENDED = /\b(ja (estou|to|tou) (falando|conversando)|(estou|to|tou) (falando|conversando) (aqui |aki |ai )?com (o |a )?corretor|ja (fui|estou sendo) atendid)/;

/** "Obrigada pela atenção", "muito obrigado pela ajuda": a thank-you of a few words, without a question. */
function isShortThanks(text: string) {
  return /^(ok |ta |certo |sim )?(muito )?(obrigad[oa]|grat[oa]|valeu|agradeco)\b/.test(text) && text.split(" ").length <= 6;
}

/** A person of the company wrote: official number or the broker's WAHA. The AI ("outbound"/assistant) never counts. */
export function isHumanReply(message: CustomerWaitingMessage) {
  if (message.direction === "outgoing") return true;
  return message.direction === "outbound" && !["assistant", "system"].includes(message.senderRole ?? "");
}

/**
 * Does this customer message ask for an answer? Closings, stickers and reactions do not; neither does a copy of a
 * message the customer already sent (the ad's ready-made text tapped again, like "Digite sua idade por favor.").
 */
export function needsReply(message: CustomerWaitingMessage, earlierCustomerTexts: ReadonlySet<string>) {
  if (message.direction !== "incoming") return false;
  if (message.mediaKind && NO_REPLY_MEDIA.has(message.mediaKind)) return false;
  if ((message.body ?? "").trim().toLowerCase() === "[text]") return false;
  const text = normalize(message.body);
  if (!text) return Boolean(message.mediaKind);
  if (ACKNOWLEDGEMENTS.has(text) || ALREADY_ATTENDED.test(text) || isShortThanks(text)) return false;
  return !earlierCustomerTexts.has(text);
}

const FRUSTRATION = /(esquec|ninguem|nao (me )?respond|sem resposta|cade|ate agora|absurdo|descaso|desist|demora|aguardando ha|faz (dias|horas)|cancel|reclama)/;

/** Signs that the wait already hurts: complaint words or a message shouted in capitals. */
export function soundsFrustrated(body: string | null | undefined) {
  const raw = body ?? "";
  if (FRUSTRATION.test(normalize(raw))) return true;
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  return upper / letters.length >= 0.7;
}

function stageFor(waitingMs: number, policy: CustomerWaitingPolicy): CustomerWaitingStage {
  if (waitingMs >= policy.reassignMinutes * 60_000) return "reassign";
  if (waitingMs >= policy.secondChargeMinutes * 60_000) return "second_charge";
  if (waitingMs >= policy.acknowledgeMinutes * 60_000) return "acknowledge";
  return "watching";
}

function thresholdMinutes(stage: Exclude<CustomerWaitingStage, "watching">, policy: CustomerWaitingPolicy) {
  return stage === "acknowledge" ? policy.acknowledgeMinutes : stage === "second_charge" ? policy.secondChargeMinutes : policy.reassignMinutes;
}

/**
 * The open waiting cycle of one lead, or null when nobody is waiting. `messages` may come in any order; only the
 * ones after the last answer matter (a person's, or the AI's before the assignment).
 */
export function assessCustomerWaiting(input: {
  messages: readonly CustomerWaitingMessage[];
  assignedAt: Date | string | null;
  now: Date;
  policy?: CustomerWaitingPolicy;
}): CustomerWaitingAssessment | null {
  const policy = input.policy ?? DEFAULT_CUSTOMER_WAITING_POLICY;
  const ordered = [...input.messages].filter((message) => Number.isFinite(time(message.sentAt))).sort((left, right) => time(left.sentAt) - time(right.sentAt));
  const assignedAt = input.assignedAt ? time(input.assignedAt) : NaN;
  // Before the assignment the AI is the one attending, so its messages answer the customer; after it, only a person does.
  let lastAnswerAt = -Infinity;
  for (const message of ordered) {
    const at = time(message.sentAt);
    const aiBeforeAssignment = message.direction === "outbound" && (!Number.isFinite(assignedAt) || at < assignedAt);
    if (isHumanReply(message) || aiBeforeAssignment) lastAnswerAt = Math.max(lastAnswerAt, at);
  }

  const earlierTexts = new Set<string>();
  const unanswered: CustomerWaitingMessage[] = [];
  for (const message of ordered) {
    if (message.direction !== "incoming") continue;
    const worthy = needsReply(message, earlierTexts);
    const text = normalize(message.body);
    if (text) earlierTexts.add(text);
    if (time(message.sentAt) > lastAnswerAt && worthy) unanswered.push(message);
  }
  if (!unanswered.length) return null;

  const cycleStartedAt = time(unanswered[0].sentAt);
  const clockStartedAt = Number.isFinite(assignedAt) ? Math.max(cycleStartedAt, assignedAt) : cycleStartedAt;
  const now = input.now.getTime();
  const waitingMs = clockStartedAt < now ? businessMillisecondsBetween(new Date(clockStartedAt), input.now) : 0;
  const stage = stageFor(waitingMs, policy);
  const nextStage = STAGE_ORDER.find((candidate) => waitingMs < thresholdMinutes(candidate, policy) * 60_000) ?? null;
  const nextStageAt = nextStage ? addBusinessMilliseconds(new Date(clockStartedAt), thresholdMinutes(nextStage, policy) * 60_000).toISOString() : null;
  const lastCustomerAt = time(unanswered[unanswered.length - 1].sentAt);
  const frustrated = [...unanswered].reverse().find((message) => soundsFrustrated(message.body));
  const quoteSource = frustrated ?? [...unanswered].reverse().find((message) => normalize(message.body).length > 0) ?? null;

  return {
    cycleStartedAt: new Date(cycleStartedAt).toISOString(),
    clockStartedAt: new Date(clockStartedAt).toISOString(),
    lastCustomerMessageAt: new Date(lastCustomerAt).toISOString(),
    unansweredCount: unanswered.length,
    waitingBusinessMinutes: Math.floor(waitingMs / 60_000),
    stage,
    nextStage,
    nextStageAt,
    urgent: Boolean(frustrated) || unanswered.length >= 3,
    customerQuote: quoteSource?.body?.trim().slice(0, 160) ?? null,
    metaWindowOpen: now - lastCustomerAt < META_WINDOW_MS,
    outsideBusinessHours: !isWithinBusinessHours(input.now),
    aiRepliedLast: ordered.some((message) => message.direction === "outbound" && time(message.sentAt) > lastCustomerAt),
  };
}

/** What the guard would do at each step; the observation mode only records it (F1). */
export const STAGE_ACTIONS: Record<Exclude<CustomerWaitingStage, "watching">, string> = {
  acknowledge: "IA acolhe o cliente e 1ª cobrança ao corretor",
  second_charge: "2ª cobrança ao corretor e aviso à gestão",
  reassign: "Troca de corretor",
};

/** Short label for screens: "Cobrado 2x", "Troca de corretor". */
export const STAGE_LABELS: Record<CustomerWaitingStage, string> = {
  watching: "Aguardando",
  acknowledge: "Cobrado 1x",
  second_charge: "Cobrado 2x",
  reassign: "Troca de corretor",
};

/** The next step, as a noun for "… às 14:20". */
export const STEP_NAMES: Record<Exclude<CustomerWaitingStage, "watching">, string> = {
  acknowledge: "1ª cobrança",
  second_charge: "2ª cobrança",
  reassign: "troca de corretor",
};
