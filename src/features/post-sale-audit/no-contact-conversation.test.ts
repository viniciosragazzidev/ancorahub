import { describe, expect, it } from "vitest";

import { postSaleAlertReasons } from "./alert-rules";
import { autoRuleQuestionFocus, detectAutoRuleKeywords } from "./auto-rule-scripts";
import type { AutoRuleKey } from "./auto-rules";
import { detectContactStatus } from "./contact-status";
import { detectPostSaleKeywords } from "./conversation-rules";
import { detectPostSaleIntents } from "./intents";
import { classifyR0AnswerByKeywords } from "./r0-rules";
import { decidePostSaleTurn, type PolicyTurn, type PostSaleAnswersWithIntents } from "./turn-policy";

/**
 * Cliente diz que não teve contato (26/11). Queixa: "os clientes dizem que ninguém falou com eles e o bot
 * encerra a conversa". Antes: "Nem me ligaram" virava pergunta repetida e depois "Deixei registrado" sem
 * alerta; na R4 "Ninguém me ligou" era só o motivo da perda; "desisti, ninguém me procurou" encerrava como
 * desistência. Agora: desculpas, alerta da coordenação no mesmo turno e oferta de um corretor para chamar.
 * A leitura usada aqui é a das palavras-chave (o caminho quando a IA falha).
 */

const EM_DASH = String.fromCharCode(0x2014);

function manualFocus(step: number, prior: PostSaleAnswersWithIntents) {
  if (step === 0) return "permissão para fazer duas perguntas";
  if (step === 1) return "se o corretor conseguiu falar";
  if (step === 2) return "como foi o atendimento";
  if (step === 3) return prior.contacted === false || prior.noContactOffer === "asked" ? "se ainda quer ajuda com o plano: quer que um corretor te chame" : "se recebeu cotação";
  return step === 4 ? "se fechou o plano" : "motivo da decisão";
}

function talk(replies: string[], input: { rule?: AutoRuleKey | null; canHandoff?: boolean } = {}) {
  const rule = input.rule === undefined ? "R1" : input.rule;
  let step = 0;
  let prior: PostSaleAnswersWithIntents = {};
  const turns: PolicyTurn[] = [];
  for (const text of replies) {
    const focus = rule ? autoRuleQuestionFocus(rule, step, prior) : manualFocus(step, prior);
    const answer = { ...(rule ? detectAutoRuleKeywords(text, focus) : detectPostSaleKeywords(text, focus)), comment: text };
    const turn = decidePostSaleTurn({ rule, step, prior, answer, reading: detectPostSaleIntents(text), text, names: { lead: "Ana", broker: "Alan", seed: "survey-1", canHandoff: input.canHandoff } });
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

function expectOffer(turn: PolicyTurn) {
  expect(turn).toMatchObject({ status: "answering", step: 3, policy: "no_contact_offer", outcome: "no_contact" });
  expect(turn.text).toMatch(/desculp/i);
  expect(turn.text).toMatch(/avisei a coordenação/);
  expect(turn.text).toMatch(/Quer que um corretor te chame/);
  expect(turn.text).not.toContain(EM_DASH);
  // O alerta "Cliente não conseguiu falar com o corretor" já sai neste turno: "avisei a coordenação" é verdade.
  expect(alertsOf(turn)).toContain("no_contact");
}

describe("leitura de 'não tive contato'", () => {
  it.each([
    "Nem me ligaram",
    "Nem falaram comigo",
    "Não fui atendida",
    "Estou aguardando até hoje",
    "Até agora nada",
    "Ninguém entrou em contato comigo até agora",
    "Nunca falei com corretor nenhum",
    "Não tive contato nenhum",
    "Não, estou esperando",
    "Não me retornaram",
  ])("%s → no_contact", (text) => {
    expect(detectContactStatus(text)).toBe("no_contact");
  });

  it("esperando a cotação é falta de continuidade, não falta de contato", () => {
    expect(detectContactStatus("Falei com ela, estou aguardando a cotação")).toBe("stalled");
  });

  it("R0 com 'nem me ligaram' é não atendido", () => {
    expect(classifyR0AnswerByKeywords("Nem me ligaram").category).toBe("not_attended");
  });
});

describe("R1: nunca encerra no escuro quando o cliente diz que ninguém falou com ele", () => {
  it.each(["Não", "Nem me ligaram", "Não fui atendida", "Estou aguardando até hoje", "Ninguém entrou em contato comigo até agora"])("'%s' pede desculpas, avisa a coordenação e oferece retorno", (reply) => {
    const turns = talk(["Pode", reply]);
    expectOffer(turns[1]);
  });

  it("dito já na abertura também", () => {
    expectOffer(talk(["Ninguém me ligou até agora"])[0]);
  });

  it("aceita a oferta: a equipe chama e a conversa fecha com o pedido registrado", () => {
    const turns = talk(["Pode", "Nem me ligaram", "Sim, por favor"]);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "no_follow_up", outcome: "no_contact" });
    expect(turns[2].text).toMatch(/equipe te chamar/);
    expect(alertsOf(turns[2])).toContain("no_contact");
  });

  it("aceita com a troca ligada: outro corretor chama, com desculpas", () => {
    const turns = talk(["Pode", "Nem me ligaram", "Sim"], { canHandoff: true });
    expect(turns[2]).toMatchObject({ status: "completed", policy: "handoff", handoff: true });
    expect(turns[2].text).toMatch(/desculpe/);
    expect(turns[2].text).toMatch(/outro corretor/);
  });

  it("pede horário: anota e a equipe chama", () => {
    const turns = talk(["Pode", "Não", "Pode me ligar amanhã às 10h"]);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "no_contact" });
    expect(turns[2].text).toMatch(/amanhã às 10h/);
  });

  it("resposta vaga à oferta: na dúvida, a equipe chama", () => {
    const turns = talk(["Pode", "Estou aguardando até hoje", "Até agora nada"]);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "no_follow_up", outcome: "no_contact" });
    expect(turns[2].answers.wantsHelp).toBe(true);
  });

  it.each(["Não", "Não quero", "Não precisa", "Já resolvi"])("recusa a oferta com '%s': encerra com desculpas, sem opt-out", (reply) => {
    const turns = talk(["Pode", "Nem me ligaram", reply]);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "no_contact_close", outcome: "no_contact" });
    expect(turns[2].text).toMatch(/[Dd]esculpe/);
    expect(turns[2].answers.optOut).not.toBe(true);
    expect(alertsOf(turns[2])).toContain("no_contact");
  });

  it("desistiu porque ninguém procurou: desculpas e oferta, nunca 'se mudar de ideia' seco", () => {
    expectOffer(talk(["Pode", "Não tive contato nenhum, desisti"])[1]);
  });

  it("fechou com outra porque ninguém procurou: desculpas e alerta, nunca 'que bom que você já resolveu'", () => {
    const turns = talk(["Pode", "Ninguém me procurou, fechei com outra corretora"]);
    expect(turns[1]).toMatchObject({ status: "completed", policy: "no_contact_close", outcome: "no_contact" });
    expect(turns[1].text).not.toMatch(/Que bom/);
    expect(turns[1].text).toMatch(/desculpe/);
    expect(alertsOf(turns[1])).toContain("no_contact");
  });

  it("quem pede para ligar junto com a queixa vai direto para a equipe", () => {
    const turns = talk(["Pode", "Ninguém me ligou, quero que me liguem"]);
    expect(turns[1]).toMatchObject({ status: "completed", policy: "no_follow_up", outcome: "no_contact" });
  });
});

describe("caso real Leila (R2, 26/11)", () => {
  it("'Ainda não' recebeu a cotação e 'Sim' quer ajuda: alerta de falta de continuidade e de pedido de ajuda", () => {
    const turns = talk(["Pode perguntar", "Ainda não", "Sim"], { rule: "R2" });
    expect(turns[1].text).toMatch(/ainda quer ajuda/);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "no_follow_up", outcome: "no_contact" });
    // Antes o alerta dizia "não conseguiu falar com o corretor"; ela falou, só não recebeu a cotação.
    expect(alertsOf(turns[2])).toEqual(["no_follow_up", "wants_help"]);
  });
});

describe("outras regras", () => {
  it("R2: 'nem falaram comigo' na pergunta da cotação não vira 'Que bom! E a decisão?'", () => {
    const turns = talk(["Pode", "Nem falaram comigo"], { rule: "R2" });
    expectOffer(turns[1]);
    expect(turns[1].text).not.toMatch(/Que bom/);
  });

  it("R4 (perdido): 'ninguém me ligou' como motivo não encerra", () => {
    const turns = talk(["Pode", "Eu não desisti, ninguém entrou em contato comigo", "Quero sim"], { rule: "R4" });
    expectOffer(turns[1]);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "no_contact" });
    expect(turns[2].handoff).toBeUndefined();
  });

  it("R3 (já cliente): 'nunca falei com corretor' também é ouvido", () => {
    const turns = talk(["Pode", "Nunca falei com corretor nenhum"], { rule: "R3", canHandoff: true });
    expectOffer(turns[1]);
    const done = talk(["Pode", "Nunca falei com corretor nenhum", "Sim"], { rule: "R3", canHandoff: true });
    expect(done[2].handoff).toBeUndefined();
  });

  it("pesquisa manual: 'não, estou esperando' e depois 'não'", () => {
    const turns = talk(["Pode", "Não, estou esperando", "Não"], { rule: null });
    expectOffer(turns[1]);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "no_contact_close" });
  });
});

describe("o que não muda", () => {
  it("falou e foi bem segue o roteiro", () => {
    const turns = talk(["Pode", "Sim, falei"]);
    expect(turns[1]).toMatchObject({ status: "answering", step: 2, policy: "script" });
  });

  it("pedido claro para parar continua opt-out", () => {
    const turns = talk(["Pode", "Nem me ligaram", "Parem de me mandar mensagem"]);
    expect(turns[2].status).toBe("opted_out");
  });
});
