import { z } from "zod";
import { isHolidayDateKey } from "@/shared/time/holidays";
import { LOSS_REASON_CATEGORIES } from "./loss-reason-check";
import { pickVariant } from "./reply-variants";

export const postSaleAnswerSchema = z.object({
  contacted: z.boolean().nullable().optional(),
  speed: z.enum(["fast", "slow", "not_applicable", "unknown"]).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "unknown"]).optional(),
  receivedQuote: z.boolean().nullable().optional(),
  closed: z.enum(["yes", "no", "deciding", "unknown"]).optional(),
  wantsHelp: z.boolean().nullable().optional(),
  reason: z.string().max(300).nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  optOut: z.boolean().optional(),
  /** Régua R5: indicaria a empresa para um amigo ou familiar. */
  recommends: z.boolean().nullable().optional(),
  /** Régua R4: categoria do motivo da perda dito pelo cliente (comparada com a do corretor). */
  lossCategory: z.enum(LOSS_REASON_CATEGORIES).nullable().optional(),
});

export type PostSaleAnswers = z.infer<typeof postSaleAnswerSchema>;

const ACTIVE_SURVEY_STATUSES = new Set(["sent", "answering"]);
const ACTIVE_SURVEY_WINDOW_MS = 5 * 86_400_000;

export function isActivePostSaleSurvey(input: { status: string; sentAt: Date | null; channelType: string | null; channelRef: string | null }, expected: { channelType: string; channelRef: string; now?: Date }) {
  const now = expected.now ?? new Date();
  return ACTIVE_SURVEY_STATUSES.has(input.status)
    && Boolean(input.sentAt && input.sentAt.getTime() >= now.getTime() - ACTIVE_SURVEY_WINDOW_MS)
    && Boolean(input.sentAt && input.sentAt.getTime() <= now.getTime())
    && input.channelType === expected.channelType
    && input.channelRef === expected.channelRef;
}

export function detectPostSaleKeywords(text: string, question = ""): PostSaleAnswers {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const focus = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const bare = value.replace(/[.!,;]+/g, " ").replace(/\s+/g, " ").trim();
  const simpleYes = /^(sim|s|claro|com certeza|isso|exatamente|pode ser|sim sim|consegui|conseguiu|recebi|falei|falei sim|recebi sim|sim recebi|sim consegui|sim falei)$/.test(bare);
  const simpleNo = /^(nao|n|ainda nao|nenhum|nenhuma|nao consegui|nao recebi|nao falei|nunca)$/.test(bare);
  const yes = /\b(sim|s|claro|conseguiu|fechei|fechamos|recebi|recebeu|falaram|falou comigo)\b/.test(value);
  const no = /\b(nao|nunca|ainda nao|ninguem|nenhum|nao recebi|nao fechou)\b/.test(value);
  // Nota só com "nota" ou um único algarismo de 1 a 5 na pergunta de nota/atendimento: "Valor 3.500,00" não é nota 3 (09/11).
  // "Bom dia", "boa tarde" e "tudo bem?" são cumprimento, não opinião sobre o atendimento (09/11).
  const withoutGreeting = value.replace(/\b(bom dia|boa tarde|boa noite|tudo bem|tudo bom|ola|oi)\b/g, " ");
  const ratingFocus = focus.includes("nota") || focus.includes("atendimento") || focus.includes("contratacao");
  const ratingMatch = value.match(/\bnota\s*(?:e\s*|eh\s*|de\s*)?([1-5])\b/) ?? (ratingFocus && !/\d[.,]\d|\d{2,}/.test(value) ? value.match(/(?:^|\D)([1-5])(?:\D|$)/) : null);
  // "Não quero mais o plano" é desistência, não pedido para parar as mensagens (09/11).
  const optOut = /\b(pare|parar|remova|remover|nao quero|nao me chame|cancele)\b/.test(value)
    && !/\bnao quero (mais )?(o plano|plano|contratar|fazer|fechar|agora)\b/.test(value);
  const permissionQuestion = focus.includes("permissao") || focus.includes("duas perguntas");
  const contactQuestion = !permissionQuestion && (focus.includes("corretor") || focus.includes("falar"));
  const quoteQuestion = focus.includes("cotacao") || focus.includes("proposta");
  const helpQuestion = focus.includes("ajuda");
  const closedQuestion = focus.includes("fechar") || focus.includes("fechou");
  const reasonQuestion = focus.includes("motivo") || focus.includes("pesou") || focus.includes("decisao");
  const explicitContactYes = /\b(falei com|falou comigo|conseguiu falar|entrou em contato|me ligou)\b/.test(value);
  const explicitContactNo = /\b(nao falei com|nao conseguiu falar|ninguem me chamou|nao entrou em contato)\b/.test(value);
  const contacted = permissionQuestion ? null
    : contactQuestion && simpleYes ? true
      : contactQuestion && simpleNo ? false
        : explicitContactYes ? true
          : explicitContactNo ? false
            : !focus ? yes ? true : no ? false : null
              : null;
  return {
    contacted,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    // Pedir cotação ("quero uma cotação") não é ter recebido: só verbos de recebimento contam (09/11).
    receivedQuote: quoteQuestion && simpleYes ? true : quoteQuestion && simpleNo ? false
      : /\b(nao|ainda nao|nunca) (recebi|recebemos|me (mandaram|mandou|enviaram|enviou|passaram|passou)|chegou)\b.*\b(cotacao|proposta|valores?|orcamento)\b|\b(cotacao|proposta|orcamento)\b.*\bnao (chegou|veio|recebi)\b/.test(value) ? false
        : /\b(recebi|recebemos|me (mandou|mandaram|enviou|enviaram|passou|passaram))\b.*\b(cotacao|proposta|valores?|orcamento)\b|\b(cotacao|proposta)\b.*\b(recebi|chegou)\b/.test(value) ? true
          : quoteQuestion && /\b(recebi|chegou|mandou|mandaram|enviou)\b/.test(value) ? !no : null,
    closed: /\b(nao|ainda nao) (fechei|fechamos|contratei|contratamos|fiz)\b/.test(value) || (closedQuestion && simpleNo) ? "no"
      : /\b(fechei|fechamos|contratei|contratamos|ja fiz|fiz o plano|assinei)\b/.test(value) || (closedQuestion && simpleYes) ? "yes"
        : /\b(decidindo|pensando|avaliando|vou ver|estudando|analisando)\b/.test(value) ? "deciding" : "unknown",
    wantsHelp: /\b(ajuda|quero que ligue|me ligue|preciso falar)\b/.test(value) ? true : helpQuestion && simpleYes ? true : helpQuestion && (simpleNo || no) ? false : null,
    speed: /\b(rapido|rapida|logo|demorou|demorada|lento|lenta)\b/.test(value) ? (/\b(demorou|demorada|lento|lenta)\b/.test(value) ? "slow" : "fast") : "unknown",
    sentiment: /\b(pessimo|pessima|ruim|insatisfeit\w*|horrivel|grosso|grossa|descaso|mal atendid\w*|atendeu mal|me tratou mal)\b/.test(withoutGreeting) ? "negative"
      : /\b(otimo|otima|excelente|bem atendid\w*|muito bom|muito boa|bom|boa|gostei|atencios\w*)\b/.test(withoutGreeting) ? "positive" : "unknown",
    reason: reasonQuestion ? text.trim().slice(0, 300) || null : null,
    comment: text.trim().slice(0, 500) || null,
    optOut,
  };
}

type TurnNames = { lead: string; broker: string; /** Id da pesquisa: escolhe a variação do texto. */ seed?: string | null };

export type PostSaleTurn = {
  status: "answering" | "completed" | "opted_out";
  step: number;
  text: string;
  answers: PostSaleAnswers;
  outcome?: "ok" | "no_contact" | "bad_service" | "closed" | "waiting" | "other";
  /** A pergunta feita neste turno, sem saudação (vai para `answers.lastQuestion`, usada no lembrete e ao retomar). */
  question?: string | null;
};

export function mergePostSaleAnswers(previous: PostSaleAnswers, answer: PostSaleAnswers) {
  return { ...previous, ...Object.fromEntries(Object.entries(answer).filter(([, value]) => value !== undefined && value !== null && value !== "unknown")) } as PostSaleAnswers;
}

const STOP_WORDS = /(pare|parar|remova|remover|nao quero|nao me chame|cancele)/;

/** "Agora não" na abertura é recusa educada, não opt-out. */
export function declinesPostSaleIntroduction(step: number, comment: string | null | undefined) {
  const normalized = (comment ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[.!]+$/g, "");
  if (step !== 0 || STOP_WORDS.test(normalized)) return false;
  return /(agora nao|nao precisa|prefiro nao|hoje nao|nao posso agora|depois eu respondo|to ocupad\w*|estou ocupad\w*)/.test(normalized) || /^(nao|agora nao|hoje nao|nao obrigad[oa])$/.test(normalized);
}

/** A pergunta desta etapa do roteiro manual já tem resposta (dita agora ou antes)? */
export function manualStepAnswered(step: number, a: PostSaleAnswers) {
  switch (step) {
    case 1: return typeof a.contacted === "boolean";
    case 2: return typeof a.rating === "number" || a.sentiment === "positive" || a.sentiment === "negative" || a.speed === "fast" || a.speed === "slow";
    case 3: return a.contacted === false ? typeof a.wantsHelp === "boolean" : typeof a.receivedQuote === "boolean" || a.closed === "yes";
    case 4: return a.closed === "yes" || a.closed === "no" || a.closed === "deciding";
    case 5: return typeof a.reason === "string" && a.reason.trim().length > 0;
    default: return false;
  }
}

function manualTurn(step: number, merged: PostSaleAnswers, names: TurnNames): PostSaleTurn {
  const v = (key: string, variants: readonly string[]) => pickVariant(names.seed, key, variants);
  const ask = (nextStep: number, text: string, question: string): PostSaleTurn => ({ status: "answering", step: nextStep, text, answers: merged, question });
  const contactQuestion = `Você conseguiu falar com ${names.broker}?`;
  const helpQuestion = "Você ainda quer ajuda com o plano?";
  const finish = (): PostSaleTurn => ({
    status: "completed",
    step,
    text: v("closing", [
      `Obrigada pelo seu tempo, ${names.lead}! Isso ajuda a gente a cuidar melhor de você.`,
      `Muito obrigada, ${names.lead}! Sua resposta ajuda muito a melhorar o nosso atendimento.`,
      `Obrigada, ${names.lead}! Foi rapidinho e ajuda demais a gente.`,
    ]),
    answers: merged,
    outcome: merged.closed === "yes" ? "closed" : "ok",
  });
  const askHelp = () => ask(3, v("help", [
    "Poxa, sinto muito. Você ainda quer ajuda com o plano?",
    `Poxa, ${names.lead}, sinto muito por isso. Você ainda quer ajuda com o plano?`,
    "Que pena, sinto muito. Você ainda quer ajuda com o plano?",
  ]), helpQuestion);
  if (step === 0) return ask(1, v("contacted", [
    `Obrigada, ${names.lead}! ${contactQuestion}`,
    `Combinado, ${names.lead}! Primeiro: você conseguiu conversar com ${names.broker}?`,
    `Obrigada, ${names.lead}! Me conta: ${names.broker} chegou a falar com você?`,
  ]), contactQuestion);
  if (step === 1) {
    if (merged.contacted === false) return askHelp();
    if (merged.contacted !== true) return ask(1, v("contacted_again", [contactQuestion, `Só para eu entender: você conseguiu falar com ${names.broker}?`]), contactQuestion);
    return ask(2, v("service", [
      "Que bom. Como foi o atendimento? Se quiser, pode dar uma nota de 1 a 5.",
      "Que bom! E como foi o atendimento? Se quiser, me dá uma nota de 1 a 5.",
      `Ótimo! O que achou do atendimento de ${names.broker}? Pode ser uma nota de 1 a 5.`,
    ]), "Como foi o atendimento? Se quiser, pode dar uma nota de 1 a 5.");
  }
  if (step === 2) {
    if (merged.contacted === false) return askHelp();
    return ask(3, v("quote", ["Você chegou a receber uma cotação?", "Obrigada! E você chegou a receber a cotação?", `Anotado. ${names.broker} chegou a te mandar uma cotação?`]), "Você chegou a receber uma cotação?");
  }
  if (step === 3 && merged.contacted === false) return {
    status: "completed",
    step,
    text: v("no_contact_end", [`Obrigada por me contar, ${names.lead}. A equipe poderá retomar seu atendimento.`, `Obrigada por avisar, ${names.lead}. Vou passar isso para a equipe.`]),
    answers: merged,
    outcome: "no_contact",
  };
  if (step === 3) return ask(4, v("closed", ["E você chegou a fechar o plano?", "E já fechou o plano ou ainda está decidindo?", "E aí, chegou a fechar o plano?"]), "Você chegou a fechar o plano?");
  if (step === 4 && merged.closed === "no") return ask(5, v("reason", ["Se quiser contar, o que mais pesou na decisão?", "Entendi. Se puder contar, o que pesou na decisão?"]), "O que mais pesou na decisão?");
  return finish();
}

export function postSaleNextTurn(step: number, previous: PostSaleAnswers, answer: PostSaleAnswers, names: TurnNames): PostSaleTurn {
  const merged = mergePostSaleAnswers(previous, answer);
  const declinesIntroduction = declinesPostSaleIntroduction(step, answer.comment);
  if (answer.optOut && !declinesIntroduction) return { status: "opted_out", step, text: "Tudo bem. Obrigada por avisar. Não vamos mais enviar mensagens de pesquisa.", answers: merged, outcome: "other" };
  if (declinesIntroduction) return { status: "completed", step, text: pickVariant(names.seed, "decline", [`Sem problema, ${names.lead}. Obrigada pelo seu tempo. Se precisar, estamos por aqui.`, `Tudo bem, ${names.lead}! Obrigada mesmo assim. Qualquer coisa, estamos por aqui.`]), answers: merged, outcome: "other" };
  let turn = manualTurn(step, merged, names);
  // Não pergunta o que o cliente já disse nesta ou em outra mensagem ("falei com o Alan e já fechei").
  for (let guard = 0; guard < 6 && turn.status === "answering" && manualStepAnswered(turn.step, merged); guard += 1) {
    turn = manualTurn(turn.step, merged, names);
  }
  return turn;
}

export function businessHoursBetween(start: Date, end: Date) {
  if (end <= start) return 0;
  let total = 0;
  const parts = (date: Date) => {
    const values = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (type: string) => values.find((part) => part.type === type)?.value ?? "";
    return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
  };
  let day = parts(start);
  const lastDay = parts(end);
  for (let index = 0; index < 370; index += 1) {
    // Feriados de `shared/time/holidays.ts` não contam (09/11): o lembrete e o "sem resposta" esperam o próximo dia útil.
    const businessDay = day.weekday >= 1 && day.weekday <= 5 && !isHolidayDateKey(`${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`);
    if (businessDay) {
      // São Paulo is UTC-03:00 in 2026. Constructing the business window from
      // the local calendar date keeps this calculation O(days), not O(minutes).
      const opening = Date.UTC(day.year, day.month - 1, day.day, 11);
      const closing = Date.UTC(day.year, day.month - 1, day.day, 21);
      total += Math.max(0, Math.min(end.getTime(), closing) - Math.max(start.getTime(), opening));
    }
    if (day.year === lastDay.year && day.month === lastDay.month && day.day === lastDay.day) break;
    const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1, 12));
    day = parts(next);
  }
  return total;
}

/** Reminder 4 business hours after the last step (09/11, Vinicios: "muda o lembrete para 4 horas"). */
export const POST_SALE_REMINDER_AFTER_MS = 4 * 3_600_000;
/** After a reminder, the survey closes as "sem resposta" when this passes without an answer. */
export const POST_SALE_NO_REPLY_AFTER_MS = 24 * 3_600_000;
/** Surveys sent before the 4 h rule went live keep the old 24 h wait for the opening reminder, so the deploy
 *  does not fire ~50 templates at once (Vigia, 09/11). */
export const POST_SALE_FOUR_HOUR_RULE_FROM = new Date("2026-11-10T03:00:00Z");
/** Free text on the official number only inside the client's 24 h window (1 h margin). */
const META_WINDOW_MS = 23 * 3_600_000;

export type PostSaleNudgeDecision =
  | { action: "none" }
  | { action: "remind_opening" }
  | { action: "remind_question" }
  | { action: "close_no_reply" };

/**
 * What to do with an unanswered survey. The reference is the client's last answer (or the send when he
 * never answered): one reminder per step, 4 business hours later; then "sem resposta" after 24 business
 * hours. Mid-conversation on the official number the reminder is free text, so it needs the 24 h window.
 * R0 never gets a reminder (it is reactive to the client's own message).
 */
export function decidePostSaleNudge(input: {
  sentAt: Date | null;
  lastReplyAt: Date | null;
  reminderSentAt: Date | null;
  channelType: string | null;
  isR0: boolean;
  now: Date;
}): PostSaleNudgeDecision {
  const reference = input.lastReplyAt ?? input.sentAt;
  if (!reference) return { action: "none" };
  const remindedThisStep = Boolean(input.reminderSentAt && input.reminderSentAt >= reference);
  if (remindedThisStep) {
    return businessHoursBetween(input.reminderSentAt!, input.now) >= POST_SALE_NO_REPLY_AFTER_MS ? { action: "close_no_reply" } : { action: "none" };
  }
  const waited = businessHoursBetween(reference, input.now);
  if (input.isR0) return waited >= POST_SALE_NO_REPLY_AFTER_MS ? { action: "close_no_reply" } : { action: "none" };
  const legacyOpening = !input.lastReplyAt && input.sentAt !== null && input.sentAt < POST_SALE_FOUR_HOUR_RULE_FROM;
  if (waited < (legacyOpening ? POST_SALE_NO_REPLY_AFTER_MS : POST_SALE_REMINDER_AFTER_MS)) return { action: "none" };
  if (!input.lastReplyAt) return { action: "remind_opening" };
  if (input.channelType === "meta" && input.now.getTime() - input.lastReplyAt.getTime() > META_WINDOW_MS) {
    return waited >= POST_SALE_NO_REPLY_AFTER_MS ? { action: "close_no_reply" } : { action: "none" };
  }
  return { action: "remind_question" };
}

/** "Retomar agora" by hand: can it go out right now? (free text on the official number needs the window). */
export function canResumePostSaleNow(input: { lastReplyAt: Date | null; channelType: string | null; now: Date }) {
  if (!input.lastReplyAt) return true; // opening reminder: template on the official number, text on WAHA
  return !(input.channelType === "meta" && input.now.getTime() - input.lastReplyAt.getTime() > META_WINDOW_MS);
}
