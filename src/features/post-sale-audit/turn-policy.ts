import { autoRuleNextTurn } from "./auto-rule-scripts";
import { resolveContactStatus, type ContactStatus } from "./contact-status";
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

export type PolicyNames = {
  lead: string;
  broker: string;
  seed?: string | null;
  /** O lead pode ir para outro corretor agora (interruptor da empresa ligado e lead elegível). */
  canHandoff?: boolean;
};

/** Pedido de troca de corretor (24/11), guardado em `answers.handoff`; quem executa é `conversation.ts`. */
export type PostSaleHandoffState = {
  status: "pending" | "done" | "skipped";
  contactStatus: ContactStatus;
  reason: string;
  requestedAt?: string;
  doneAt?: string;
  result?: string;
  newBrokerId?: string | null;
};

export type PostSaleAnswersWithIntents = PostSaleAnswers & {
  intents?: PostSaleIntentState;
  lastQuestion?: string | null;
  /** Quantas vezes seguidas a mesma pergunta já foi repetida (24/11: no máximo uma). */
  questionRepeats?: number;
  handoff?: PostSaleHandoffState;
};

export type PolicyKind = "script" | "hold_question" | "wrong_person" | "health_urgency" | "resume" | "closed_elsewhere" | "gave_up" | "handoff" | "no_follow_up" | "declined" | "repeat_guard";

export type PolicyTurn = Omit<PostSaleTurn, "answers"> & {
  answers: PostSaleAnswersWithIntents;
  policy: PolicyKind;
  /** Número errado: encerra, bloqueia novas pesquisas e marca o número na conversa do lead. */
  wrongNumber?: boolean;
  /** Passar o lead para outro corretor (só quando `names.canHandoff`). */
  handoff?: boolean;
};

/** Motivo gravado na distribuição e na auditoria. */
export function handoffReason(contactStatus: ContactStatus, broker: string) {
  return contactStatus === "no_contact"
    ? `pós-venda: cliente sem contato do corretor ${broker}`
    : `pós-venda: cliente sem continuidade do corretor ${broker}`;
}

function sameQuestion(a: string | null | undefined, b: string | null | undefined) {
  const clean = (value: string | null | undefined) => (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(clean(a)) && clean(a) === clean(b);
}

const PERMISSION_WORDS = new Set(["pode", "sim", "s", "claro", "ok", "okay", "perguntar", "pergunta", "mandar", "manda", "fazer", "faz", "ser", "vamos", "la", "fique", "fica", "a", "vontade", "tudo", "bem", "bom", "boa", "beleza", "blz", "com", "certeza", "dia", "tarde", "noite", "oi", "ola", "pois", "nao", "e", "ai", "isso", "de", "boas", "por", "favor", "pf", "obrigado", "obrigada", "posso", "responder", "respondo"]);

/** "Pode perguntar", "Sim, claro!", "Bom dia, pode sim": só autoriza a pesquisa, não é fato (caso Dayana, 09/11). */
export function isBarePermission(text: string) {
  const words = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 8 && words.every((word) => PERMISSION_WORDS.has(word)) && !words.includes("nao");
}

function plain(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

const CLEAR_OPT_OUT = /\b(nao quero mais(?! (o |um |uma )?(plano|contratar|fazer|fechar|convenio))|nao quero (responder|receber|pesquisa|mensage\w*|mais nada)|(para|pare|parem|parar) de (me )?(mandar|enviar|perguntar|chamar|mandando|enviando|perguntando)|nao me (mande|mandem|envie|enviem|chame|chamem|pergunte|perguntem) mais|(sempre|toda hora|de novo) a mesma pergunta|mesma pergunta)\b/;
const REPEAT_COMPLAINT = /\b(mesma pergunta|sempre a mesma|repetid\w*|de novo a mesma)\b/;

/**
 * Pedido claro para parar (Carmen Lucia, 24/11: "Obrigada, não quero mais, está enviando sempre a mesma
 * pergunta"): vira opt-out pelas palavras, mesmo que a IA leia outra coisa. "Não quero mais o plano" segue
 * como desistência.
 */
export function isClearPostSaleOptOut(text: string) {
  return CLEAR_OPT_OUT.test(plain(text));
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
    handoffStalled: v("handoff_stalled", [
      `Entendi, ${names.lead}, e sinto muito pela falta de retorno. Vou passar seu atendimento para outro corretor, que vai te chamar em seguida.`,
      `Poxa, ${names.lead}, sinto muito que o atendimento não andou. Já estou passando você para outro corretor, que vai te chamar em seguida.`,
    ]),
    handoffNoContact: v("handoff_no_contact", [
      `Combinado, ${names.lead}! Vou passar seu atendimento para outro corretor, que vai te chamar em seguida.`,
      `Certo, ${names.lead}! Já estou passando você para outro corretor, que vai te chamar em seguida.`,
    ]),
    noFollowUp: v("no_follow_up", [
      `Entendi, ${names.lead}, e sinto muito pela falta de retorno. Já avisei a equipe para retomar seu atendimento por aqui.`,
      `Poxa, ${names.lead}, sinto muito que o atendimento não andou. Avisei a equipe para continuar com você por aqui.`,
    ]),
    declined: `Tudo bem, ${names.lead}. Obrigada pelo seu tempo. Se precisar, é só chamar por aqui.`,
    unclearClose: v("unclear_close", [
      `Obrigada, ${names.lead}! Deixei sua resposta registrada para a equipe dar uma olhada.`,
      `Obrigada por me contar, ${names.lead}! Deixei tudo anotado para a equipe.`,
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
  const clearOptOut = isClearPostSaleOptOut(input.text);
  const base = barePermission
    ? { ...(input.answer.optOut !== undefined ? { optOut: input.answer.optOut } : {}), comment: input.answer.comment }
    : clearOptOut ? { ...input.answer, optOut: true } : input.answer;
  // Contato com o corretor (24/11): R1, R2 e a pesquisa manual leem as cinco respostas possíveis.
  const contactRule = rule === null || rule === "R1" || rule === "R2";
  // Um "sim" solto só vale como "falou com o corretor" quando a pergunta é essa (abertura ou etapa 1 da R1/manual).
  const contactStep = (rule === null || rule === "R1") && step <= 1;
  const read = contactRule && !barePermission ? resolveContactStatus(base.contactStatus, input.text) : null;
  const contactStatus = read === "talked_ok" && !contactStep ? null : read;
  const withContact: PostSaleAnswers = { ...base, ...(contactStatus ? { contactStatus } : {}) };
  if (contactStatus === "stalled" || (contactStatus === "talked_ok" && typeof withContact.contacted !== "boolean")) withContact.contacted = true;
  // "Ninguém me ligou" vence a palavra-chave "me ligou" lida como contato.
  else if (contactStatus === "no_contact") withContact.contacted = false;
  const answer = answerFromIntents(withContact, reading, names);
  const t = texts(names);
  const withState = (answers: PostSaleAnswers, lastQuestion?: string | null, extra: Partial<PostSaleAnswersWithIntents> = {}): PostSaleAnswersWithIntents => ({
    ...answers,
    ...(intentState.list.length ? { intents: intentState } : {}),
    ...(lastQuestion !== undefined ? { lastQuestion } : prior.lastQuestion !== undefined ? { lastQuestion: prior.lastQuestion } : {}),
    ...extra,
  });
  const merged = mergePostSaleAnswers(prior, answer);
  const close = (policy: PolicyKind, text: string, outcome: PostSaleTurn["outcome"], extra: Partial<PolicyTurn> = {}, state: Partial<PostSaleAnswersWithIntents> = {}): PolicyTurn => ({
    status: "completed", step, text, answers: withState(merged, undefined, { questionRepeats: 0, ...state }), outcome, policy, ...extra,
  });
  const script = () => rule ? autoRuleNextTurn(rule, step, prior, answer, names) : postSaleNextTurn(step, prior, answer, names);
  // Falta de contato ou de continuidade: passa para outro corretor quando pode; senão, avisa a equipe.
  const noFollowUp = (status: ContactStatus): PolicyTurn => names.canHandoff
    ? close("handoff", status === "no_contact" ? t.handoffNoContact : t.handoffStalled, "no_contact", { handoff: true }, { handoff: { status: "pending", contactStatus: status, reason: handoffReason(status, names.broker) } })
    : close("no_follow_up", status === "no_contact" ? t.resume : t.noFollowUp, "no_contact");

  // 1. Opt-out: o roteiro já trata (inclusive "agora não" na abertura, que é recusa e não opt-out).
  if (answer.optOut) {
    const turn = script();
    // Reclamou da pergunta repetida: pede desculpas antes de encerrar (24/11).
    const sorry = turn.status === "opted_out" && REPEAT_COMPLAINT.test(plain(input.text)) ? `Desculpe pelas mensagens repetidas, ${names.lead}. ` : "";
    return { ...turn, text: `${sorry}${turn.text}`, answers: withState(turn.answers, undefined, { questionRepeats: 0 }), policy: "script" };
  }
  if (now("wrong_person")) return close("wrong_person", t.wrongPerson, "other", { wrongNumber: true });
  if (now("health_urgency")) return close("health_urgency", t.urgency, "other");
  const complaintPrefix = now("complaint") ? `${t.complaintShort} ` : "";
  // Já cliente (R3, R5) ou já perdido (R4, em que o motivo é a própria resposta): o roteiro segue.
  const openLead = rule !== "R3" && rule !== "R4" && rule !== "R5";
  const decided = now("closed") || now("closed_elsewhere") || now("gave_up");
  // 2. Teve contato, mas o corretor parou (Toinha e Carmen, 24/11): nunca repete a pergunta.
  if (openLead && contactStatus === "stalled" && !decided) return noFollowUp("stalled");
  // 3. Não teve contato (ou não recebeu cotação) e ainda quer ajuda: resposta à pergunta de ajuda, ou pedido de retomar.
  const wantsMore = merged.wantsHelp === true || RESUME_INTENTS.some((intent) => intents.includes(intent));
  if (openLead && contactRule && step === 3 && (merged.contacted === false || merged.receivedQuote === false) && wantsMore && !decided) {
    return noFollowUp(merged.contacted === false ? "no_contact" : "stalled");
  }
  // 4. Não quer responder: encerra com educação, sem insistir.
  if (step > 0 && contactStatus === "declined" && !decided && !answerHasFact(answer)) return close("declined", t.declined, "other");
  if (RESUME_INTENTS.some((intent) => intents.includes(intent))) {
    const text = `${complaintPrefix}${t.resume}${intentState.scheduleText && now("scheduling") ? t.schedule(intentState.scheduleText) : ""}${now("price_request") ? t.priceNote : ""}`;
    return close("resume", text, merged.contacted === false ? "no_contact" : "waiting");
  }
  if (openLead && now("closed_elsewhere")) return close("closed_elsewhere", `${complaintPrefix}${t.closedElsewhere}`, "other");
  if (openLead && now("gave_up")) return close("gave_up", `${complaintPrefix}${t.gaveUp}`, "other");

  // Nunca repete a mesma pergunta mais de uma vez (24/11). Na segunda vez, encerra com educação.
  const guarded = (turn: PolicyTurn): PolicyTurn => {
    if (turn.status !== "answering" || !sameQuestion(turn.question, prior.lastQuestion)) {
      return { ...turn, answers: { ...turn.answers, questionRepeats: 0 } };
    }
    const repeats = (prior.questionRepeats ?? 0) + 1;
    if (repeats <= 1) return { ...turn, answers: { ...turn.answers, questionRepeats: repeats } };
    return close("repeat_guard", t.unclearClose, "other");
  };

  // Pergunta fora do roteiro sem responder nada: acolhe em uma frase e repete a pergunta pendente.
  // Pesquisa anterior a 09/11 não tem a pergunta guardada: aí só acolhe e o roteiro segue.
  if (now("question") && step > 0 && !answerHasFact(answer) && prior.lastQuestion?.trim()) {
    const pending = prior.lastQuestion.trim();
    return guarded({ status: "answering", step, text: `${t.question} ${pending}`, answers: withState(mergePostSaleAnswers(prior, { comment: answer.comment, sentiment: answer.sentiment })), policy: "hold_question", question: pending });
  }
  const turn = script();
  const prefix = now("complaint") ? `${t.complaint} ` : now("question") ? `${t.question} ` : "";
  return guarded({
    ...turn,
    text: prefix ? `${prefix}${turn.text}` : turn.text,
    answers: withState(turn.answers, turn.status === "answering" ? turn.question ?? null : undefined),
    policy: "script",
  });
}

/** R0 (cliente voltou a escrever): mesmas intenções, por cima da classificação da R0. */
export function decideR0Turn(input: { answer: R0Answer; reading: PostSaleIntentReading; names: PolicyNames; text?: string }): R0Turn & { wrongNumber?: boolean; policy: PolicyKind; handoff?: boolean; contactStatus?: ContactStatus | null } {
  const intents = input.reading.intents ?? [];
  const t = texts(input.names);
  const optOut = Boolean(input.answer.optOut) || intents.includes("opt_out") || (input.text ? isClearPostSaleOptOut(input.text) : false);
  if (!optOut && intents.includes("wrong_person")) return { status: "completed", outcome: "other", awaitsTeam: false, text: t.wrongPerson, wrongNumber: true, policy: "wrong_person" };
  if (!optOut && intents.includes("health_urgency")) return { status: "completed", outcome: "r0_other", awaitsTeam: true, text: t.urgency, policy: "health_urgency" };
  const resume = RESUME_INTENTS.some((intent) => intents.includes(intent));
  const contactStatus = resolveContactStatus(input.answer.contactStatus, input.text);
  const decided = input.answer.category === "closed_or_gave_up" || intents.includes("closed_elsewhere") || intents.includes("gave_up");
  // "Começou e parou de responder" na R0 é não atendido (24/11), mesmo quando o cliente também pede algo.
  const notAttended = !decided && (input.answer.category === "not_attended" || contactStatus === "stalled" || contactStatus === "no_contact");
  const answer: R0Answer = {
    ...input.answer,
    optOut,
    category: notAttended ? "not_attended" : resume && input.answer.category === "other_subject" ? "wants_more" : input.answer.category,
    contactStatus,
  };
  if (!optOut && notAttended && input.names.canHandoff) {
    const stalled = contactStatus !== "no_contact";
    return { status: "completed", outcome: "r0_not_attended", awaitsTeam: true, text: stalled ? t.handoffStalled : t.handoffNoContact, policy: "handoff", handoff: true, contactStatus: stalled ? "stalled" : "no_contact" };
  }
  const turn = r0NextTurn(answer, { lead: input.names.lead, seed: input.names.seed });
  if (turn.status !== "completed") return { ...turn, policy: "script", contactStatus };
  const scheduled = input.reading.scheduleText && intents.includes("scheduling") ? t.schedule(input.reading.scheduleText) : "";
  const complaint = intents.includes("complaint") && answer.category !== "not_attended" ? `${t.complaintShort} ` : "";
  return { ...turn, text: `${complaint}${turn.text}${turn.awaitsTeam ? scheduled : ""}`, policy: resume ? "resume" : "script", contactStatus };
}
