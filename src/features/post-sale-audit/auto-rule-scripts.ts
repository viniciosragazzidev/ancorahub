import { detectPostSaleKeywords, type PostSaleAnswers } from "./conversation-rules";
import type { AutoRuleKey } from "./auto-rules";

/**
 * Roteiro curto de cada regra da régua (R1 a R5). Mesmo motor da pesquisa manual: a abertura
 * (template aprovado no Meta, texto no WAHA) pede licença; depois, uma pergunta por vez.
 * A IA só extrai fatos da resposta; se falhar, valem as palavras-chave. Nunca fala de preço.
 */

type Names = { lead: string; broker: string };

export type AutoRuleTurn = {
  status: "answering" | "completed" | "opted_out";
  step: number;
  text: string;
  answers: PostSaleAnswers;
  outcome?: "ok" | "no_contact" | "bad_service" | "closed" | "waiting" | "other";
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

function merge(previous: PostSaleAnswers, answer: PostSaleAnswers) {
  return { ...previous, ...Object.fromEntries(Object.entries(answer).filter(([, value]) => value !== undefined && value !== null && value !== "unknown")) } as PostSaleAnswers;
}

const STOP = /\b(pare|parar|remova|remover|nao quero|nao me chame|cancele)\b/;

function closing(names: Names) {
  return `Obrigada pelo seu tempo, ${names.lead}! Isso ajuda a gente a cuidar melhor de você.`;
}

function qualityOutcome(answers: PostSaleAnswers, fallback: AutoRuleTurn["outcome"]): AutoRuleTurn["outcome"] {
  if (answers.sentiment === "negative" || (typeof answers.rating === "number" && answers.rating <= 2)) return "bad_service";
  return fallback;
}

/** Próximo passo da conversa da régua. Etapa 0 é a resposta à apresentação. */
export function autoRuleNextTurn(rule: AutoRuleKey, step: number, previous: PostSaleAnswers, answer: PostSaleAnswers, names: Names): AutoRuleTurn {
  const merged = merge(previous, answer);
  const comment = (answer.comment ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const explicitStop = STOP.test(comment);
  const declinesIntroduction = step === 0 && !explicitStop && (answer.contacted === false || /\b(agora nao|nao precisa|prefiro nao|hoje nao)\b/.test(comment) || /^(nao|agora nao|hoje nao)$/.test(comment.trim()));
  if (answer.optOut && !declinesIntroduction) return { status: "opted_out", step, text: "Tudo bem. Obrigada por avisar. Não vamos mais enviar mensagens de pesquisa.", answers: merged, outcome: "other" };
  if (declinesIntroduction) return { status: "completed", step, text: `Sem problema, ${names.lead}. Obrigada pelo seu tempo. Se precisar, estamos por aqui.`, answers: merged, outcome: "other" };

  switch (rule) {
    case "R1": {
      if (step === 0) return { status: "answering", step: 1, text: `Obrigada, ${names.lead}! Você conseguiu falar com ${names.broker}?`, answers: merged };
      if (step === 1) {
        if (merged.contacted === false) return { status: "answering", step: 3, text: "Poxa, sinto muito. Você ainda quer ajuda com o plano?", answers: merged };
        if (merged.contacted !== true) return { status: "answering", step: 1, text: `Só para eu entender: você conseguiu falar com ${names.broker}?`, answers: merged };
        return { status: "answering", step: 2, text: "Que bom! E o atendimento foi rápido?", answers: merged };
      }
      if (step === 2) return { status: "completed", step, text: closing(names), answers: merged, outcome: merged.speed === "slow" ? "bad_service" : qualityOutcome(merged, "ok") };
      return { status: "completed", step, text: `Obrigada por me contar, ${names.lead}. A equipe poderá retomar seu atendimento.`, answers: merged, outcome: "no_contact" };
    }
    case "R2": {
      if (step === 0) return { status: "answering", step: 1, text: `Obrigada, ${names.lead}! Você chegou a receber a cotação de ${names.broker}?`, answers: merged };
      if (step === 1) {
        if (merged.receivedQuote === false) return { status: "answering", step: 3, text: "Entendi. Você ainda quer ajuda com o plano?", answers: merged };
        return { status: "answering", step: 2, text: "E como está a decisão: já fechou, ainda está pensando ou desistiu? Se quiser, me diga também uma nota de 1 a 5 para o atendimento.", answers: merged };
      }
      if (step === 2) return { status: "completed", step, text: closing(names), answers: merged, outcome: qualityOutcome(merged, merged.closed === "yes" ? "closed" : merged.closed === "deciding" ? "waiting" : "ok") };
      return { status: "completed", step, text: `Obrigada por me contar, ${names.lead}. A equipe poderá retomar seu atendimento.`, answers: merged, outcome: merged.contacted === false ? "no_contact" : "waiting" };
    }
    case "R3": {
      if (step === 0) return { status: "answering", step: 1, text: `Obrigada, ${names.lead}! Como foi a contratação do plano? Se quiser, me dê uma nota de 1 a 5.`, answers: merged };
      if (step === 1) return { status: "answering", step: 2, text: "Ficou alguma dúvida sobre o plano que a gente possa ajudar?", answers: merged };
      return {
        status: "completed",
        step,
        text: merged.wantsHelp ? `Combinado, ${names.lead}. Vou pedir para a equipe te ajudar com isso por aqui.` : closing(names),
        answers: { ...merged, closed: merged.closed && merged.closed !== "unknown" ? merged.closed : "yes" },
        outcome: qualityOutcome(merged, "closed"),
      };
    }
    case "R4": {
      if (step === 0) return { status: "answering", step: 1, text: `Obrigada, ${names.lead}! Se puder contar, o que mais pesou na sua decisão?`, answers: merged };
      const reason = merged.reason ?? (answer.comment ? answer.comment.slice(0, 300) : null);
      return { status: "completed", step, text: `Obrigada por me contar, ${names.lead}. Se mudar de ideia, é só chamar por aqui.`, answers: { ...merged, reason, closed: merged.closed && merged.closed !== "unknown" ? merged.closed : "no" }, outcome: "other" };
    }
    case "R5": {
      if (step === 0) return { status: "answering", step: 1, text: `Obrigada, ${names.lead}! Está tudo certo com o plano até aqui?`, answers: merged };
      if (step === 1) {
        if (merged.sentiment === "negative" || merged.wantsHelp === true) return { status: "answering", step: 2, text: "Poxa, sinto muito. Quer que alguém da equipe te ajude com isso?", answers: merged };
        return { status: "answering", step: 2, text: "Que bom! E você indicaria a gente para um amigo ou familiar?", answers: merged };
      }
      return { status: "completed", step, text: merged.wantsHelp ? `Combinado, ${names.lead}. Vou pedir para a equipe falar com você por aqui.` : closing(names), answers: merged, outcome: qualityOutcome(merged, "ok") };
    }
  }
}
