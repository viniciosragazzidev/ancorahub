import { describe, expect, it } from "vitest";

import { postSaleAlertReasons } from "./alert-rules";
import { autoRuleQuestionFocus, detectAutoRuleKeywords } from "./auto-rule-scripts";
import { detectPostSaleIntents } from "./intents";
import { decidePostSaleTurn, type PolicyTurn, type PostSaleAnswersWithIntents } from "./turn-policy";

/**
 * R4 (lead marcado como perdido). Caso real de 26/11, Carina com a Izabel:
 *   Pesquisa: "Posso te fazer duas perguntas rápidas?"  Cliente: "Pode perguntar"
 *   Pesquisa: "Combinado, Carina! O que mais pesou na sua decisão?"
 *   Cliente: "O fato de todo o plano ter coparticipação"
 *   Pesquisa: "Obrigada pela sinceridade, Carina. Quando precisar, é só chamar por aqui."
 * Problemas: perguntou o motivo sem saber se ela fechou, ainda decidia ou se o atendimento terminou; e
 * encerrou um motivo que tem solução (existem planos sem coparticipação). Leitura por palavras-chave.
 */

const EM_DASH = String.fromCharCode(0x2014);

function talk(replies: string[]) {
  let step = 0;
  let prior: PostSaleAnswersWithIntents = {};
  const turns: PolicyTurn[] = [];
  for (const text of replies) {
    const focus = autoRuleQuestionFocus("R4", step, prior);
    const answer = { ...detectAutoRuleKeywords(text, focus), comment: text };
    const turn = decidePostSaleTurn({ rule: "R4", step, prior, answer, reading: detectPostSaleIntents(text), text, names: { lead: "Carina", broker: "Izabel", seed: "survey-carina" } });
    turns.push(turn);
    step = turn.step;
    prior = turn.answers;
    if (turn.status !== "answering") break;
  }
  return turns;
}

function alertsOf(turn: PolicyTurn) {
  return postSaleAlertReasons({ outcome: turn.outcome ?? null, rating: turn.answers.rating ?? null, answers: turn.answers });
}

describe("R4: primeiro a decisão, depois o motivo", () => {
  it("depois do 'Pode perguntar' pergunta se fechou, se está decidindo ou se não seguiu", () => {
    const [first] = talk(["Pode perguntar"]);
    expect(first).toMatchObject({ status: "answering", step: 1 });
    expect(first.text).toMatch(/fechar o plano|fechou o plano/);
    expect(first.text).toMatch(/decidindo/);
    expect(first.text).not.toMatch(/pesou/);
  });

  it("caso Carina: o motivo 'coparticipação' vira oferta de planos sem coparticipação", () => {
    const turns = talk(["Pode perguntar", "O fato de todo o plano ter coparticipação"]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[1].text).toMatch(/sem coparticipação/);
    expect(turns[1].text).toMatch(/Quer que um corretor/);
    expect(turns[1].text).not.toContain(EM_DASH);
    expect(turns[1].answers.reason).toBe("O fato de todo o plano ter coparticipação");
  });

  it.each(["Quero sim", "Sim", "Pode ser"])("caso Carina, aceita com '%s': um corretor chama e a gestão recebe o pedido", (reply) => {
    const turns = talk(["Pode perguntar", "O fato de todo o plano ter coparticipação", reply]);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "waiting" });
    expect(turns[2].text).toMatch(/corretor/);
    expect(alertsOf(turns[2])).toContain("wants_help");
  });

  it.each(["Não", "Não quero", "Não precisa"])("caso Carina, recusa com '%s': encerra com educação, sem opt-out", (reply) => {
    const turns = talk(["Pode perguntar", "O fato de todo o plano ter coparticipação", reply]);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "other" });
    expect(turns[2].answers.optOut).not.toBe(true);
  });

  it("não fechou: só então pergunta o motivo", () => {
    const turns = talk(["Pode perguntar", "Não fechei", "Desisti porque a rede não tinha o hospital que eu queria"]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 2 });
    expect(turns[1].text).toMatch(/pesou/);
    expect(turns[2]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[2].text).toMatch(/rede ou a cobertura/);
  });

  it("ainda está decidindo: oferece ajuda para decidir, sem perguntar 'o que pesou'", () => {
    const turns = talk(["Pode perguntar", "Ainda estou pensando"]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[1].text).toMatch(/ajud|comparar/);
    expect(turns[1].text).not.toMatch(/pesou/);
  });

  it("caso real Alcino (26/11): 'Ainda não resolvi' é cliente em aberto, não perda", () => {
    const turns = talk(["Pode perguntar", "Ainda não resolvi"]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[1].answers.closed).toBe("deciding");
    expect(turns[1].text).not.toMatch(/pesou|Se mudar de ideia/);
    const accepted = talk(["Pode perguntar", "Ainda não resolvi", "Sim"]);
    expect(accepted[2]).toMatchObject({ status: "completed", outcome: "waiting" });
    expect(alertsOf(accepted[2])).toContain("wants_help");
  });

  it.each(["Ainda não fechei", "Ainda estou vendo", "Não decidi ainda"])("'%s' também é cliente em aberto", (reply) => {
    const turns = talk(["Pode perguntar", reply]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[1].answers.closed).toBe("deciding");
  });

  it("já fechou: agradece e encerra, sem perguntar o motivo", () => {
    const turns = talk(["Pode perguntar", "Fechei sim"]);
    expect(turns[1]).toMatchObject({ status: "completed", outcome: "closed" });
    expect(turns[1].text).not.toMatch(/pesou/);
  });

  it("motivo sem solução de plano (já tem plano pela empresa): agradece e encerra", () => {
    const turns = talk(["Pode perguntar", "Não fechei", "Consegui plano pela empresa do meu marido"]);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "other" });
  });

  it("atendimento que nem começou: desculpas, alerta e oferta de retorno", () => {
    const turns = talk(["Pode perguntar", "Nem me ligaram"]);
    expect(turns[1]).toMatchObject({ status: "answering", policy: "no_contact_offer", outcome: "no_contact" });
    expect(alertsOf(turns[1])).toContain("no_contact");
  });
});
