import { autoRuleNextTurn } from "./auto-rule-scripts";
import type { AutoRuleKey } from "./auto-rules";
import { mergePostSaleAnswers, postSaleNextTurn, type PostSaleAnswers, type PostSaleTurn } from "./conversation-rules";
import {
  closedWithBroker,
  mergeIntentState,
  readIntentState,
  RESUME_INTENTS,
  type PostSaleIntentReading,
  type PostSaleIntentState,
} from "./intents";
import { r0NextTurn, type R0Answer, type R0Turn } from "./r0-rules";
import { pickVariant } from "./reply-variants";

/**
 * Política da conversa inteligente (09/11). Vale em qualquer etapa e antes do roteiro:
 * opt-out encerra; número errado encerra e marca o número; urgência de saúde orienta o 192 e avisa a
 * direção; pedido de preço, de falar com alguém ou de horário encerra com "a equipe vai retomar" (nunca
 * um preço) e gera o alerta "Quer retomar o atendimento"; já fechou por fora ou desistiu encerra com
 * cordialidade; reclamação gera alerta e a conversa segue; pergunta fora do roteiro é acolhida em uma
 * frase e a pergunta pendente volta. O roteiro pula o que o cliente já respondeu. Puro, sem I/O.
 */

export type PolicyNames = { lead: string; broker: string; seed?: string | null };

export type PostSaleAnswersWithIntents = PostSaleAnswers & { intents?: PostSaleIntentState; lastQuestion?: string | null };

export type PolicyKind = "script" | "hold_question" | "wrong_person" | "health_urgency" | "resume" | "closed_elsewhere" | "gave_up";

export type PolicyTurn = Omit<PostSaleTurn, "answers"> & {
  answers: PostSaleAnswersWithIntents;
  policy: PolicyKind;
  /** Número errado: encerra, bloqueia novas pesquisas e marca o número na conversa do lead. */
  wrongNumber?: boolean;
};

const PERMISSION_WORDS = new Set(["pode", "sim", "s", "claro", "ok", "okay", "perguntar", "pergunta", "mandar", "manda", "fazer", "faz", "ser", "vamos", "la", "fique", "fica", "a", "vontade", "tudo", "bem", "bom", "boa", "beleza", "blz", "com", "certeza", "dia", "tarde", "noite", "oi", "ola", "pois", "nao", "e", "ai", "isso", "de", "boas", "por", "favor", "pf", "obrigado", "obrigada", "posso", "responder", "respondo"]);

/** "Pode perguntar", "Sim, claro!", "Bom dia, pode sim": só autoriza a pesquisa, não é fato (caso Dayana, 09/11). */
export function isBarePermission(text: string) {
  const words = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 8 && words.every((word) => PERMISSION_WORDS.has(word)) && !words.includes("nao");
}

/** A mensagem respondeu alguma coisa da pesquisa (e não só perguntou ou comentou)? */
export function answerHasFact(answer: PostSaleAnswers) {
  return typeof answer.contacted === "boolean"
    || typeof answer.rating === "number"
    || typeof answer.receivedQuote === "boolean"
    || answer.closed === "yes" || answer.closed === "no" || answer.closed === "deciding"
    || typeof answer.wantsHelp === "boolean"
    || typeof answer.recommends === "boolean"
    || answer.speed === "fast" || answer.speed === "slow"
    || answer.sentiment === "positive" || answer.sentiment === "negative"
    || Boolean(answer.lossCategory);
}

function texts(names: PolicyNames) {
  const v = (key: string, variants: readonly string[]) => pickVariant(names.seed, `policy:${key}`, variants);
  return {
    wrongPerson: "Desculpe o engano! Já anotei aqui e não vamos mais mandar pesquisas para este número. Tenha um ótimo dia.",
    urgency: `Sinto muito, ${names.lead}. Se for uma emergência, procure agora o pronto-socorro mais próximo ou ligue 192 (SAMU). Já avisei a nossa equipe para falar com você por aqui.`,
    resume: v("resume", [
      `Anotei, ${names.lead}! Já avisei a equipe e alguém vai retomar seu atendimento por aqui.`,
      `Combinado, ${names.lead}! Passei seu pedido para a equipe, que vai continuar seu atendimento por aqui.`,
      `Certo, ${names.lead}! Avisei a equipe para retomar seu atendimento por aqui.`,
    ]),
    priceNote: v("price", [" Valores e condições a equipe passa direitinho no atendimento.", " Os valores certinhos a equipe te passa no atendimento."]),
    schedule: (when: string) => ` Deixei anotado o horário que você pediu: ${when}.`,
    closedElsewhere: v("closed_elsewhere", [
      `Que bom que você já resolveu, ${names.lead}! Obrigada por avisar. Se precisar de algo, é só chamar por aqui.`,
      `Fico feliz que já esteja com o plano, ${names.lead}! Obrigada por contar. Qualquer coisa, estamos por aqui.`,
    ]),
    gaveUp: v("gave_up", [
      `Entendi, ${names.lead}. Obrigada por me contar. Se mudar de ideia, é só chamar por aqui.`,
      `Tudo bem, ${names.lead}, obrigada por avisar. Quando fizer sentido, é só chamar por aqui.`,
    ]),
    complaint: v("complaint", [
      `Sinto muito por isso, ${names.lead}. Já registrei e vou levar para a coordenação.`,
      `Poxa, ${names.lead}, sinto muito. Deixei registrado para a coordenação olhar com atenção.`,
    ]),
    complaintShort: "Sinto muito pelo que aconteceu.",
    question: v("question", [
      `Anotei sua dúvida, ${names.lead}, e ela fica registrada para a equipe.`,
      `Boa pergunta, ${names.lead}! Deixei anotada para a equipe.`,
    ]),
  };
}

/**
 * Ajusta a resposta com o que as intenções já dizem: "fechei com o Alan" vale como falou com o
 * corretor e fechou; fechou por fora ou desistiu vale como não fechou (com o motivo).
 */
export function answerFromIntents(answer: PostSaleAnswers, reading: PostSaleIntentReading, names: PolicyNames): PostSaleAnswers {
  const intents = reading.intents ?? [];
  const next: PostSaleAnswers = { ...answer };
  if (intents.includes("opt_out")) next.optOut = true;
  if (intents.includes("closed_elsewhere")) {
    next.closed = "no";
    next.reason ??= reading.closedWith ? `Fechou com outro: ${reading.closedWith}` : "Fechou com outro";
  } else if (intents.includes("closed")) {
    if (!next.closed || next.closed === "unknown") next.closed = "yes";
    if (closedWithBroker(reading.closedWith, names.broker) && typeof next.contacted !== "boolean") next.contacted = true;
  }
  if (intents.includes("gave_up")) {
    if (!next.closed || next.closed === "unknown") next.closed = "no";
    next.reason ??= reading.gaveUpReason ?? null;
  }
  if (intents.includes("praise") && (!next.sentiment || next.sentiment === "unknown")) next.sentiment = "positive";
  return next;
}

export function decidePostSaleTurn(input: {
  rule: AutoRuleKey | null;
  step: number;
  prior: PostSaleAnswersWithIntents;
  answer: PostSaleAnswers;
  reading: PostSaleIntentReading;
  text: string;
  names: PolicyNames;
}): PolicyTurn {
  const { rule, step, prior, names } = input;
  // Abertura: "Pode perguntar" só autoriza; fatos ditos de verdade ("falei com o Alan e já fechei") valem.
  const barePermission = step === 0 && isBarePermission(input.text);
  const reading: PostSaleIntentReading = barePermission ? { intents: [] } : input.reading;
  const intents = reading.intents ?? [];
  const now = (intent: (typeof intents)[number]) => intents.includes(intent);
  const intentState = mergeIntentState(readIntentState(prior), reading, input.text);
  const base = barePermission
    ? { ...(input.answer.optOut !== undefined ? { optOut: input.answer.optOut } : {}), comment: input.answer.comment }
    : input.answer;
  const answer = answerFromIntents(base, reading, names);
  const t = texts(names);
  const withState = (answers: PostSaleAnswers, lastQuestion?: string | null): PostSaleAnswersWithIntents => ({
    ...answers,
    ...(intentState.list.length ? { intents: intentState } : {}),
    ...(lastQuestion !== undefined ? { lastQuestion } : prior.lastQuestion !== undefined ? { lastQuestion: prior.lastQuestion } : {}),
  });
  const merged = mergePostSaleAnswers(prior, answer);
  const close = (policy: PolicyKind, text: string, outcome: PostSaleTurn["outcome"], extra: Partial<PolicyTurn> = {}): PolicyTurn => ({
    status: "completed", step, text, answers: withState(merged), outcome, policy, ...extra,
  });
  const script = () => rule ? autoRuleNextTurn(rule, step, prior, answer, names) : postSaleNextTurn(step, prior, answer, names);

  // 1. Opt-out: o roteiro já trata (inclusive "agora não" na abertura, que é recusa e não opt-out).
  if (answer.optOut) {
    const turn = script();
    return { ...turn, answers: withState(turn.answers), policy: "script" };
  }
  if (now("wrong_person")) return close("wrong_person", t.wrongPerson, "other", { wrongNumber: true });
  if (now("health_urgency")) return close("health_urgency", t.urgency, "other");
  const complaintPrefix = now("complaint") ? `${t.complaintShort} ` : "";
  if (RESUME_INTENTS.some((intent) => intents.includes(intent))) {
    const text = `${complaintPrefix}${t.resume}${intentState.scheduleText && now("scheduling") ? t.schedule(intentState.scheduleText) : ""}${now("price_request") ? t.priceNote : ""}`;
    return close("resume", text, merged.contacted === false ? "no_contact" : "waiting");
  }
  // Já cliente (R3, R5) ou já perdido (R4, em que o motivo é a própria resposta): o roteiro segue.
  const openLead = rule !== "R3" && rule !== "R4" && rule !== "R5";
  if (openLead && now("closed_elsewhere")) return close("closed_elsewhere", `${complaintPrefix}${t.closedElsewhere}`, "other");
  if (openLead && now("gave_up")) return close("gave_up", `${complaintPrefix}${t.gaveUp}`, "other");

  // Pergunta fora do roteiro sem responder nada: acolhe em uma frase e repete a pergunta pendente.
  // Pesquisa anterior a 09/11 não tem a pergunta guardada: aí só acolhe e o roteiro segue.
  if (now("question") && step > 0 && !answerHasFact(answer) && prior.lastQuestion?.trim()) {
    const pending = prior.lastQuestion.trim();
    return { status: "answering", step, text: `${t.question} ${pending}`, answers: withState(mergePostSaleAnswers(prior, { comment: answer.comment, sentiment: answer.sentiment })), policy: "hold_question", question: pending };
  }
  const turn = script();
  const prefix = now("complaint") ? `${t.complaint} ` : now("question") ? `${t.question} ` : "";
  return {
    ...turn,
    text: prefix ? `${prefix}${turn.text}` : turn.text,
    answers: withState(turn.answers, turn.status === "answering" ? turn.question ?? null : undefined),
    policy: "script",
  };
}

/** R0 (cliente voltou a escrever): mesmas intenções, por cima da classificação da R0. */
export function decideR0Turn(input: { answer: R0Answer; reading: PostSaleIntentReading; names: PolicyNames }): R0Turn & { wrongNumber?: boolean; policy: PolicyKind } {
  const intents = input.reading.intents ?? [];
  const t = texts(input.names);
  const optOut = Boolean(input.answer.optOut) || intents.includes("opt_out");
  if (!optOut && intents.includes("wrong_person")) return { status: "completed", outcome: "other", awaitsTeam: false, text: t.wrongPerson, wrongNumber: true, policy: "wrong_person" };
  if (!optOut && intents.includes("health_urgency")) return { status: "completed", outcome: "r0_other", awaitsTeam: true, text: t.urgency, policy: "health_urgency" };
  const resume = RESUME_INTENTS.some((intent) => intents.includes(intent));
  const answer: R0Answer = {
    ...input.answer,
    optOut,
    category: resume && input.answer.category === "other_subject" ? "wants_more" : input.answer.category,
  };
  const turn = r0NextTurn(answer, { lead: input.names.lead, seed: input.names.seed });
  if (turn.status !== "completed") return { ...turn, policy: "script" };
  const scheduled = input.reading.scheduleText && intents.includes("scheduling") ? t.schedule(input.reading.scheduleText) : "";
  const complaint = intents.includes("complaint") && answer.category !== "not_attended" ? `${t.complaintShort} ` : "";
  return { ...turn, text: `${complaint}${turn.text}${turn.awaitsTeam ? scheduled : ""}`, policy: resume ? "resume" : "script" };
}
