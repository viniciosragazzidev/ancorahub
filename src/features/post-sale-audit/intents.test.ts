import { describe, expect, it } from "vitest";

import { detectPostSaleKeywords } from "./conversation-rules";
import { closedWithBroker, detectPostSaleIntents, extractScheduleText, mergeIntentState, postSaleReadingInstructions, readIntentState, type PostSaleIntent } from "./intents";

/**
 * Conjunto de avaliação (09/11). "Real": respostas de clientes lidas em produção (só leitura, a partir de
 * 06/11), sem nome nem telefone; cidades e bairros trocados por [cidade]. "Sintética": casos difíceis.
 * Cada caso diz as intenções que DEVEM aparecer e as que NÃO podem aparecer (precisão).
 */
type Case = { text: string; source: "real" | "sintética"; must?: PostSaleIntent[]; mustNot?: PostSaleIntent[] };

const CASES: Case[] = [
  // Reais, respostas à pesquisa de 09/11.
  { text: "Agora não", source: "real", mustNot: ["opt_out", "gave_up", "wrong_person"] },
  { text: "Pode perguntar", source: "real", mustNot: ["price_request", "question", "closed"] },
  { text: "Não", source: "real", mustNot: ["opt_out", "wrong_person"] },
  { text: "Manda os valores por favor", source: "real", must: ["price_request"] },
  { text: "Tenho 45 anos", source: "real", mustNot: ["price_request", "complaint"] },
  { text: "Moro em [cidade] RJ", source: "real", mustNot: ["question", "scheduling"] },
  { text: "Bom dia  Já fiz o plano", source: "real", must: ["closed"], mustNot: ["praise", "closed_elsewhere"] },
  { text: "SulAmérica", source: "real", mustNot: ["closed", "price_request"] },
  { text: "Valor 3.500,00", source: "real", mustNot: ["price_request"] },
  { text: "No momento não está dando para fazer obrigada", source: "real", must: ["gave_up"], mustNot: ["opt_out"] },
  { text: "Foi 5 o problema é q agora não está dando", source: "real", must: ["gave_up"], mustNot: ["complaint"] },
  // Reais, mensagens de clientes já com corretor (mesmo público da R0).
  { text: "Gostaria de saber o valor para 1 vida", source: "real", must: ["price_request"] },
  { text: "Aonde tem atendimento aqui em [cidade]", source: "real", must: ["question"], mustNot: ["price_request"] },
  { text: "E qual é a rede credenciada?", source: "real", must: ["question"] },
  { text: "Uma corretora que não sabe preço.prde idade não está preparada", source: "real", must: ["complaint"], mustNot: ["price_request"] },
  { text: "Tá bom deixa pra.la  muita demora", source: "real", must: ["gave_up", "complaint"] },
  { text: "Vcs compram carência", source: "real", must: ["question"] },
  { text: "Bom dia a msg foi errada. A minha filha que quer tirar umas dúvidas.", source: "real", mustNot: ["wrong_person"] },
  { text: "E outra coisa eu não sou MEI", source: "real", mustNot: ["wrong_person"] },
  { text: "Meu irmão morreu no corredor sem o atendimento passou mal e levar ele para os SUS ele ficou uma semana lá", source: "real", mustNot: ["health_urgency"] },
  { text: "Aceita em outro hospital ? Urgência e emergência?", source: "real", must: ["question"], mustNot: ["health_urgency"] },
  { text: "Muito alto esse valor", source: "real", mustNot: ["price_request"] },
  { text: "Quero saber sobre carências", source: "real", must: ["question"] },
  { text: "Tenho 70 anos qual o valor", source: "real", must: ["price_request"] },
  // Sintéticas.
  { text: "Falei com o Alan e já fechei", source: "sintética", must: ["closed"], mustNot: ["closed_elsewhere"] },
  { text: "Me liga amanhã às 10h", source: "sintética", must: ["wants_human", "scheduling"] },
  { text: "O corretor foi muito grosso comigo", source: "sintética", must: ["complaint"], mustNot: ["praise"] },
  { text: "Ninguém me respondeu até hoje", source: "sintética", must: ["complaint"] },
  { text: "Número errado, não conheço essa pessoa", source: "sintética", must: ["wrong_person"] },
  { text: "Não sou a Maria, foi engano", source: "sintética", must: ["wrong_person"] },
  { text: "Fechei com outra corretora, saiu mais barato", source: "sintética", must: ["closed", "closed_elsewhere"] },
  { text: "Estou passando mal, preciso de um hospital agora", source: "sintética", must: ["health_urgency"] },
  { text: "Pare de me mandar mensagem", source: "sintética", must: ["opt_out"] },
  { text: "Não quero mais o plano", source: "sintética", must: ["gave_up"], mustNot: ["opt_out"] },
  { text: "A Bia foi excelente, super atenciosa", source: "sintética", must: ["praise"], mustNot: ["complaint"] },
  { text: "Quero falar com o corretor agora", source: "sintética", must: ["wants_human"] },
  { text: "O plano cobre parto?", source: "sintética", must: ["question"] },
  { text: "Não me liga não, prefiro mensagem", source: "sintética", mustNot: ["wants_human", "scheduling"] },
  { text: "Ele me passou informação errada sobre a carência", source: "sintética", must: ["complaint"] },
  { text: "Já tenho plano pela empresa", source: "sintética", must: ["closed_elsewhere"] },
];

describe("palavras-chave das intenções (quando a IA falha)", () => {
  for (const item of CASES) {
    it(`${item.source}: ${item.text}`, () => {
      const found = detectPostSaleIntents(item.text).intents ?? [];
      for (const intent of item.must ?? []) expect(found, `deveria achar ${intent}`).toContain(intent);
      for (const intent of item.mustNot ?? []) expect(found, `não deveria achar ${intent}`).not.toContain(intent);
    });
  }

  it("guarda o detalhe: tipo da reclamação, tema da dúvida e horário como o cliente escreveu", () => {
    expect(detectPostSaleIntents("O corretor foi muito grosso comigo")).toMatchObject({ complaintKind: "rude" });
    expect(detectPostSaleIntents("Ninguém me respondeu até hoje")).toMatchObject({ complaintKind: "disappeared" });
    expect(detectPostSaleIntents("Tá bom deixa pra.la  muita demora")).toMatchObject({ complaintKind: "slow" });
    expect(detectPostSaleIntents("Vcs compram carência")).toMatchObject({ questionTopic: "carencia" });
    expect(detectPostSaleIntents("E qual é a rede credenciada?")).toMatchObject({ questionTopic: "network" });
    expect(detectPostSaleIntents("Me liga amanhã às 10h").scheduleText).toBe("amanhã às 10h");
    expect(extractScheduleText("pode ser na sexta à tarde")).toBe("sexta à tarde");
    expect(extractScheduleText("Tenho 45 anos")).toBeNull();
  });

  it("fechou com o próprio corretor não é fechou por fora", () => {
    const reading = detectPostSaleIntents("Já fechei com o Alan");
    expect(reading.closedWith).toBe("Alan");
    expect(closedWithBroker(reading.closedWith, "Alan")).toBe(true);
    expect(closedWithBroker("SulAmérica", "Alan")).toBe(false);
    expect(closedWithBroker("Alan", "corretor")).toBe(false);
  });

  it("acumula as intenções entre mensagens sem apagar o que já foi dito", () => {
    const first = mergeIntentState(null, detectPostSaleIntents("Me liga amanhã às 10h"), "Me liga amanhã às 10h");
    const second = mergeIntentState(first, detectPostSaleIntents("O corretor sumiu"), "O corretor sumiu");
    expect(second.list).toEqual(expect.arrayContaining(["wants_human", "scheduling", "complaint"]));
    expect(second.scheduleText).toBe("amanhã às 10h");
    expect(second.complaintQuote).toBe("O corretor sumiu");
    expect(readIntentState({ intents: second })?.list).toEqual(second.list);
    expect(readIntentState({ intents: { list: ["inventado", "praise"] } })?.list).toEqual(["praise"]);
  });
});

describe("palavras-chave da resposta: precisão dos casos reais", () => {
  it("'Valor 3.500,00' não vira nota 3 e 'Bom dia' não vira elogio", () => {
    expect(detectPostSaleKeywords("Valor 3.500,00", "como foi o atendimento").rating).toBeNull();
    expect(detectPostSaleKeywords("Bom dia  Já fiz o plano", "se o corretor conseguiu falar")).toMatchObject({ sentiment: "unknown", closed: "yes" });
  });

  it("'Foi 5' na pergunta do atendimento é nota 5", () => {
    expect(detectPostSaleKeywords("Foi 5 o problema é q agora não está dando", "como foi o atendimento").rating).toBe(5);
  });

  it("pedir cotação não é ter recebido; 'não quero mais o plano' não é opt-out", () => {
    expect(detectPostSaleKeywords("Quero uma cotação nova").receivedQuote).toBeNull();
    expect(detectPostSaleKeywords("Não recebi a cotação").receivedQuote).toBe(false);
    expect(detectPostSaleKeywords("Recebi a cotação sim").receivedQuote).toBe(true);
    expect(detectPostSaleKeywords("Não quero mais o plano").optOut).toBe(false);
    expect(detectPostSaleKeywords("Não quero mais").optOut).toBe(true);
  });

  it("'não' só responde 'quer ajuda?' quando essa é a pergunta", () => {
    expect(detectPostSaleKeywords("não", "se o corretor conseguiu falar").wantsHelp).toBeNull();
    expect(detectPostSaleKeywords("não", "se ainda quer ajuda com o plano").wantsHelp).toBe(false);
  });
});

describe("instruções da IA", () => {
  it("pedem resposta e intenções, sem preço e sem travessão", () => {
    const text = postSaleReadingInstructions({ step: 1, question: "se o corretor conseguiu falar", broker: "Alan", askLossCategory: false });
    expect(text).toContain("intents");
    expect(text).toContain("price_request");
    expect(text).toContain("não estime preço");
    expect(text).not.toContain(String.fromCharCode(0x2014));
    expect(postSaleReadingInstructions({ step: 1, question: "motivo", broker: "Alan", askLossCategory: true })).toContain("lossCategory");
    expect(postSaleReadingInstructions({ step: 1, question: "x", broker: "o corretor", askLossCategory: false, r0: true })).toContain("closed_or_gave_up");
  });
});
