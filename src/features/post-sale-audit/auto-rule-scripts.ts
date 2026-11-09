import { declinesPostSaleIntroduction, detectPostSaleKeywords, mergePostSaleAnswers, type PostSaleAnswers } from "./conversation-rules";
import type { AutoRuleKey } from "./auto-rules";
import { pickVariant } from "./reply-variants";

/**
 * Roteiro curto de cada regra da régua (R1 a R5). Mesmo motor da pesquisa manual: a abertura
 * (template aprovado no Meta, texto no WAHA) pede licença; depois, uma pergunta por vez.
 * A IA só extrai fatos da resposta; se falhar, valem as palavras-chave. Nunca fala de preço.
 */

type Names = { lead: string; broker: string; /** Id da pesquisa: escolhe a variação do texto. */ seed?: string | null };

export type AutoRuleTurn = {
  status: "answering" | "completed" | "opted_out";
  step: number;
  text: string;
  answers: PostSaleAnswers;
  outcome?: "ok" | "no_contact" | "bad_service" | "closed" | "waiting" | "other";
  /** A pergunta feita neste turno, sem saudação. */
  question?: string | null;
};

/** Pergunta de cada etapa, dita ao interpretador (e às palavras-chave) para entender respostas curtas. */
export function autoRuleQuestionFocus(rule: AutoRuleKey, step: number, previous: PostSaleAnswers): string {
  if (step === 0) return "permissão para fazer duas perguntas";
  switch (rule) {
    case "R1":
      return step === 1 ? "se o corretor conseguiu falar" : step === 2 ? "se o atendimento foi rápido" : "se ainda quer ajuda com o plano";
    case "R2":
      return step === 1 ? "se recebeu cotação" : step === 2 ? "se fechou o plano ou ainda está decidindo, e nota de 1 a 5" : "se ainda quer ajuda com o plano";
    case "R3":
      return step === 1 ? "como foi a contratação, nota de 1 a 5" : "se ficou alguma dúvida sobre o plano";
    case "R4":
      return "motivo: o que mais pesou na decisão";
    case "R5":
      return step === 1 ? "se está tudo certo com o plano" : previous.sentiment === "negative" ? "se quer ajuda da equipe" : "se indicaria para um amigo";
  }
}

const YES = /^(sim|s|claro|com certeza|isso|exatamente|pode ser|indicaria|indico|tudo certo|tudo sim|ta tudo certo|esta tudo certo|tudo ok|ok)$/;
const NO = /^(nao|n|ainda nao|nenhum|nenhuma|nao indicaria|nao indico)$/;

/** Palavras-chave da régua: as da pesquisa manual mais rapidez, dúvida, plano em ordem e indicação. */
export function detectAutoRuleKeywords(text: string, focus: string): PostSaleAnswers {
  const base = detectPostSaleKeywords(text, focus);
  const value = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[.!?]+$/g, "");
  const yes = YES.test(value);
  const no = NO.test(value);
  if (focus.includes("rápido")) {
    if (yes) base.speed = "fast";
    else if (no) base.speed = "slow";
  }
  if (focus.includes("dúvida")) {
    base.wantsHelp = /\b(duvida|ajuda|nao entendi|como funciona)\b/.test(value) && !no ? true : yes ? true : no || /\b(tudo certo|tudo claro|nenhuma)\b/.test(value) ? false : base.wantsHelp;
  }
  if (focus.includes("tudo certo")) {
    if (yes || /\b(tudo certo|tudo otimo|tudo bem|tudo ok)\b/.test(value)) base.sentiment = "positive";
    else if (no || /\b(problema|nao esta|nao ta|ruim)\b/.test(value)) base.sentiment = "negative";
  }
  if (focus.includes("indicaria")) {
    base.recommends = yes || /\b(indicaria|indico|recomendo|recomendaria)\b/.test(value) && !/\bnao (indicaria|indico|recomendo|recomendaria)\b/.test(value) ? true : no || /\bnao (indicaria|indico|recomendo|recomendaria)\b/.test(value) ? false : null;
  }
  return base;
}

const STOP = /\b(pare|parar|remova|remover|nao quero|nao me chame|cancele)\b/;

function qualityOutcome(answers: PostSaleAnswers, fallback: AutoRuleTurn["outcome"]): AutoRuleTurn["outcome"] {
  // Nota 4 ou 5 vence um "negativo" solto ("foi 5, o problema é que agora não dá"): precisão do alerta (09/11).
  if (typeof answers.rating === "number") return answers.rating <= 2 ? "bad_service" : fallback;
  if (answers.sentiment === "negative") return "bad_service";
  return fallback;
}

/** A pergunta desta etapa da regra já tem resposta (dita agora ou antes)? */
export function autoRuleStepAnswered(rule: AutoRuleKey, step: number, a: PostSaleAnswers): boolean {
  const opinion = typeof a.rating === "number" || a.sentiment === "positive" || a.sentiment === "negative";
  const decided = a.closed === "yes" || a.closed === "no" || a.closed === "deciding";
  switch (rule) {
    case "R1": return step === 1 ? typeof a.contacted === "boolean" : step === 2 ? a.speed === "fast" || a.speed === "slow" : step === 3 ? typeof a.wantsHelp === "boolean" : false;
    case "R2": return step === 1 ? typeof a.receivedQuote === "boolean" || decided : step === 2 ? decided : step === 3 ? typeof a.wantsHelp === "boolean" : false;
    case "R3": return step === 1 ? opinion : step === 2 ? typeof a.wantsHelp === "boolean" : false;
    case "R4": return step === 1 ? Boolean(a.reason?.trim()) || Boolean(a.lossCategory) : false;
    case "R5": return step === 1 ? a.sentiment === "positive" || a.sentiment === "negative" || a.wantsHelp === true : step === 2 ? (a.sentiment === "negative" ? typeof a.wantsHelp === "boolean" : typeof a.recommends === "boolean") : false;
  }
}

function ruleTurn(rule: AutoRuleKey, step: number, merged: PostSaleAnswers, answer: PostSaleAnswers, names: Names): AutoRuleTurn {
  const v = (key: string, variants: readonly string[]) => pickVariant(names.seed, `${rule}:${key}`, variants);
  const ask = (nextStep: number, text: string, question: string): AutoRuleTurn => ({ status: "answering", step: nextStep, text, answers: merged, question });
  const closing = () => v("closing", [
    `Obrigada pelo seu tempo, ${names.lead}! Isso ajuda a gente a cuidar melhor de você.`,
    `Muito obrigada, ${names.lead}! Sua resposta ajuda muito a melhorar o nosso atendimento.`,
    `Obrigada, ${names.lead}! Foi rapidinho e ajuda demais a gente.`,
  ]);
  const teamWillResume = () => v("team", [`Obrigada por me contar, ${names.lead}. A equipe poderá retomar seu atendimento.`, `Obrigada por avisar, ${names.lead}. Vou passar isso para a equipe.`]);
  const askHelp = (first: string) => ask(3, v("help", [first, `Poxa, ${names.lead}, sinto muito. Você ainda quer ajuda com o plano?`]), "Você ainda quer ajuda com o plano?");
  switch (rule) {
    case "R1": {
      const contact = `Você conseguiu falar com ${names.broker}?`;
      if (step === 0) return ask(1, v("contacted", [`Obrigada, ${names.lead}! ${contact}`, `Combinado, ${names.lead}! Primeiro: você conseguiu conversar com ${names.broker}?`, `Obrigada, ${names.lead}! Me conta: ${names.broker} chegou a falar com você?`]), contact);
      if (step === 1) {
        if (merged.contacted === false) return askHelp("Poxa, sinto muito. Você ainda quer ajuda com o plano?");
        if (merged.contacted !== true) return ask(1, `Só para eu entender: você conseguiu falar com ${names.broker}?`, contact);
        return ask(2, v("speed", ["Que bom! E o atendimento foi rápido?", `Que bom! E ${names.broker} te respondeu rápido?`, "Ótimo! E o atendimento foi rápido?"]), "O atendimento foi rápido?");
      }
      if (step === 2) return { status: "completed", step, text: closing(), answers: merged, outcome: merged.speed === "slow" ? "bad_service" : qualityOutcome(merged, merged.closed === "yes" ? "closed" : "ok") };
      return { status: "completed", step, text: teamWillResume(), answers: merged, outcome: "no_contact" };
    }
    case "R2": {
      const quote = `Você chegou a receber a cotação de ${names.broker}?`;
      if (step === 0) return ask(1, v("quote", [`Obrigada, ${names.lead}! ${quote}`, `Combinado, ${names.lead}! ${names.broker} chegou a te mandar a cotação?`]), quote);
      if (step === 1) {
        if (merged.receivedQuote === false) return askHelp("Entendi. Você ainda quer ajuda com o plano?");
        return ask(2, v("decision", [
          "E como está a decisão: já fechou, ainda está pensando ou desistiu? Se quiser, me diga também uma nota de 1 a 5 para o atendimento.",
          "Que bom! E a decisão, como está: já fechou, ainda está pensando ou desistiu? Se quiser, dê também uma nota de 1 a 5 para o atendimento.",
        ]), "Como está a decisão: já fechou, ainda está pensando ou desistiu?");
      }
      if (step === 2) return { status: "completed", step, text: closing(), answers: merged, outcome: qualityOutcome(merged, merged.closed === "yes" ? "closed" : merged.closed === "deciding" ? "waiting" : "ok") };
      return { status: "completed", step, text: teamWillResume(), answers: merged, outcome: merged.contacted === false ? "no_contact" : "waiting" };
    }
    case "R3": {
      if (step === 0) return ask(1, v("hiring", [`Obrigada, ${names.lead}! Como foi a contratação do plano? Se quiser, me dê uma nota de 1 a 5.`, `Combinado, ${names.lead}! O que achou da contratação do plano? Pode ser uma nota de 1 a 5.`]), "Como foi a contratação do plano? Se quiser, me dê uma nota de 1 a 5.");
      if (step === 1) return ask(2, v("doubt", ["Ficou alguma dúvida sobre o plano que a gente possa ajudar?", "Obrigada! Ficou alguma dúvida sobre o plano em que a gente possa ajudar?"]), "Ficou alguma dúvida sobre o plano?");
      return {
        status: "completed",
        step,
        text: merged.wantsHelp ? `Combinado, ${names.lead}. Vou pedir para a equipe te ajudar com isso por aqui.` : closing(),
        answers: { ...merged, closed: merged.closed && merged.closed !== "unknown" ? merged.closed : "yes" },
        outcome: qualityOutcome(merged, "closed"),
      };
    }
    case "R4": {
      if (step === 0) return ask(1, v("reason", [`Obrigada, ${names.lead}! Se puder contar, o que mais pesou na sua decisão?`, `Combinado, ${names.lead}! O que mais pesou na sua decisão?`]), "O que mais pesou na sua decisão?");
      const reason = merged.reason ?? (answer.comment ? answer.comment.slice(0, 300) : null);
      return { status: "completed", step, text: v("lost_end", [`Obrigada por me contar, ${names.lead}. Se mudar de ideia, é só chamar por aqui.`, `Obrigada pela sinceridade, ${names.lead}. Quando precisar, é só chamar por aqui.`]), answers: { ...merged, reason, closed: merged.closed && merged.closed !== "unknown" ? merged.closed : "no" }, outcome: "other" };
    }
    case "R5": {
      if (step === 0) return ask(1, v("all_good", [`Obrigada, ${names.lead}! Está tudo certo com o plano até aqui?`, `Combinado, ${names.lead}! E aí, tudo certo com o plano até aqui?`]), "Está tudo certo com o plano até aqui?");
      if (step === 1) {
        if (merged.sentiment === "negative" || merged.wantsHelp === true) return ask(2, "Poxa, sinto muito. Quer que alguém da equipe te ajude com isso?", "Quer que alguém da equipe te ajude com isso?");
        return ask(2, v("recommend", ["Que bom! E você indicaria a gente para um amigo ou familiar?", "Que ótimo! Você indicaria a gente para um amigo ou alguém da família?"]), "Você indicaria a gente para um amigo ou familiar?");
      }
      return { status: "completed", step, text: merged.wantsHelp ? `Combinado, ${names.lead}. Vou pedir para a equipe falar com você por aqui.` : closing(), answers: merged, outcome: qualityOutcome(merged, "ok") };
    }
  }
}

/** Próximo passo da conversa da régua. Etapa 0 é a resposta à apresentação. */
export function autoRuleNextTurn(rule: AutoRuleKey, step: number, previous: PostSaleAnswers, answer: PostSaleAnswers, names: Names): AutoRuleTurn {
  const merged = mergePostSaleAnswers(previous, answer);
  const comment = (answer.comment ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const declinesIntroduction = !STOP.test(comment) && declinesPostSaleIntroduction(step, answer.comment);
  if (answer.optOut && !declinesIntroduction) return { status: "opted_out", step, text: "Tudo bem. Obrigada por avisar. Não vamos mais enviar mensagens de pesquisa.", answers: merged, outcome: "other" };
  if (declinesIntroduction) return { status: "completed", step, text: pickVariant(names.seed, "decline", [`Sem problema, ${names.lead}. Obrigada pelo seu tempo. Se precisar, estamos por aqui.`, `Tudo bem, ${names.lead}! Obrigada mesmo assim. Qualquer coisa, estamos por aqui.`]), answers: merged, outcome: "other" };
  let turn = ruleTurn(rule, step, merged, answer, names);
  // Não repete pergunta já respondida nesta ou em outra mensagem.
  for (let guard = 0; guard < 4 && turn.status === "answering" && autoRuleStepAnswered(rule, turn.step, merged); guard += 1) {
    turn = ruleTurn(rule, turn.step, merged, {}, names);
  }
  return turn;
}
