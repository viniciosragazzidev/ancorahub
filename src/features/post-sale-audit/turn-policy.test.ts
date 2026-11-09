import { describe, expect, it } from "vitest";

import { postSaleAlertMessage, postSaleAlertReasons } from "./alert-rules";
import { autoRuleQuestionFocus, detectAutoRuleKeywords } from "./auto-rule-scripts";
import type { AutoRuleKey } from "./auto-rules";
import { detectPostSaleKeywords, type PostSaleAnswers } from "./conversation-rules";
import { detectPostSaleIntents, type PostSaleIntentReading } from "./intents";
import { classifyR0AnswerByKeywords } from "./r0-rules";
import { answerChips, intentDetails, responseGroups } from "./responses-view";
import { decidePostSaleTurn, decideR0Turn, isBarePermission, type PostSaleAnswersWithIntents, type PolicyTurn } from "./turn-policy";

const EM_DASH = String.fromCharCode(0x2014);
const names = { lead: "Ana", broker: "Alan" };
const MANUAL_FOCUS = ["permissão para fazer duas perguntas", "se o corretor conseguiu falar", "como foi o atendimento", "se recebeu cotação", "se fechou o plano", "motivo da decisão"];

/** Uma mensagem com a IA "mockada": a leitura vem pronta (ou das palavras-chave, como no caminho sem IA). */
function turnOf(input: { text: string; step?: number; prior?: PostSaleAnswersWithIntents; rule?: AutoRuleKey | null; answer?: PostSaleAnswers; reading?: PostSaleIntentReading; seed?: string }): PolicyTurn {
  const step = input.step ?? 0;
  const rule = input.rule ?? null;
  const prior = input.prior ?? {};
  // Mesmo foco que conversation.ts dá ao interpretador (etapa 3 sem contato pergunta se ainda quer ajuda).
  const focus = rule ? autoRuleQuestionFocus(rule, step, prior) : step === 3 && prior.contacted === false ? "se ainda quer ajuda com o plano" : MANUAL_FOCUS[step] ?? "motivo da decisão";
  const answer = { ...(input.answer ?? (rule ? detectAutoRuleKeywords(input.text, focus) : detectPostSaleKeywords(input.text, focus))) };
  answer.comment ??= input.text;
  return decidePostSaleTurn({ rule, step, prior, answer, reading: input.reading ?? detectPostSaleIntents(input.text), text: input.text, names: { ...names, seed: input.seed } });
}

/** Conversa inteira pelas palavras-chave. */
function talk(replies: string[], rule: AutoRuleKey | null = null) {
  let step = 0;
  let prior: PostSaleAnswersWithIntents = {};
  const turns: PolicyTurn[] = [];
  for (const text of replies) {
    const turn = turnOf({ text, step, prior, rule });
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

describe("política da conversa inteligente", () => {
  it("'falei com o Alan e já fechei' não pergunta de novo se falou, se recebeu cotação ou se fechou", () => {
    const turns = talk(["Pode perguntar", "Falei com o Alan e já fechei", "Nota 5"]);
    expect(turns[0].text).toContain("Alan");
    expect(turns[1]).toMatchObject({ status: "answering", step: 2 });
    expect(turns[1].text).toMatch(/atendimento/);
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "closed" });
    expect(turns[2].answers).toMatchObject({ contacted: true, closed: "yes", rating: 5 });
  });

  it("fatos ditos já na abertura também pulam perguntas", () => {
    const turn = turnOf({ text: "Oi! Já fechei com o Alan, foi ótimo", step: 0 });
    expect(turn.answers).toMatchObject({ contacted: true, closed: "yes" });
    expect(turn.status).toBe("completed");
  });

  it("'Pode perguntar' na abertura não vira fato, mesmo se a IA disser que falou com o corretor", () => {
    expect(isBarePermission("Pode perguntar")).toBe(true);
    expect(isBarePermission("Bom dia, pode sim!")).toBe(true);
    expect(isBarePermission("Não")).toBe(false);
    expect(isBarePermission("Falei com o Alan")).toBe(false);
    const turn = turnOf({ text: "Pode perguntar", answer: { contacted: true, sentiment: "positive" }, reading: { intents: [] } });
    expect(turn).toMatchObject({ status: "answering", step: 1 });
    expect(turn.answers.contacted).toBeUndefined();
  });

  it("pedido de preço: encerra com 'a equipe vai retomar', nunca dá valor, e alerta 'Quer retomar o atendimento'", () => {
    const turn = turnOf({ text: "Manda os valores por favor", step: 1 });
    expect(turn).toMatchObject({ status: "completed", outcome: "waiting", policy: "resume" });
    expect(turn.text).toMatch(/equipe/);
    expect(turn.text).not.toMatch(/R\$|\d/);
    expect(alertsOf(turn)).toEqual(["wants_resume"]);
    expect(postSaleAlertMessage("wants_resume", turn.answers)).toContain("Pediu valores");
  });

  it("'me liga amanhã às 10h': guarda o horário, responde sem prometer a ligação e põe o horário no alerta", () => {
    const turn = turnOf({ text: "Me liga amanhã às 10h", step: 2, prior: { contacted: true } });
    expect(turn.answers.intents?.scheduleText).toBe("amanhã às 10h");
    expect(turn.text).toContain("amanhã às 10h");
    expect(turn.text).not.toMatch(/vamos te ligar|vai te ligar/i);
    expect(postSaleAlertMessage("wants_resume", turn.answers)).toContain("Pediu contato: amanhã às 10h");
  });

  it("sem contato e pedindo para falar com o corretor: sem contato + retomar, sem 'pediu ajuda' duplicado", () => {
    const turn = turnOf({ text: "Ninguém me ligou, quero falar com um corretor", step: 1, answer: { contacted: false, wantsHelp: true } });
    expect(turn).toMatchObject({ status: "completed", outcome: "no_contact" });
    expect(alertsOf(turn)).toEqual(["no_contact", "wants_resume"]);
  });

  it("reclamação: alerta com a fala do cliente e a conversa segue para a próxima pergunta", () => {
    const turn = turnOf({ text: "Foi grosso comigo, nota 2", step: 2, prior: { contacted: true } });
    expect(turn).toMatchObject({ status: "answering", step: 3 });
    expect(turn.text).toMatch(/^Sinto muito/);
    expect(turn.text).toMatch(/cotação/);
    expect(alertsOf(turn)).toEqual(["low_rating", "broker_complaint"]);
    expect(postSaleAlertMessage("broker_complaint", turn.answers)).toContain("Foi grosso comigo");
  });

  it("reclamação de sumiço junto com 'não foi atendido' não duplica o alerta", () => {
    const turn = turnOf({ text: "Ninguém me respondeu", step: 1, answer: { contacted: false } });
    const final = turnOf({ text: "Sim", step: turn.step, prior: turn.answers });
    expect(final.outcome).toBe("no_contact");
    expect(alertsOf(final)).toEqual(["no_contact", "wants_help"]);
  });

  it("número errado: encerra, marca o número e não alerta", () => {
    const turn = turnOf({ text: "Número errado, não conheço essa pessoa", step: 0 });
    expect(turn).toMatchObject({ status: "completed", outcome: "other", wrongNumber: true, policy: "wrong_person" });
    expect(alertsOf(turn)).toEqual([]);
    expect(answerChips({ status: "completed", outcome: "other", rating: null, answers: turn.answers as Record<string, unknown> }).map((c) => c.label)).toEqual(["Número errado"]);
  });

  it("urgência de saúde: orienta o 192, encerra e alerta a direção", () => {
    const turn = turnOf({ text: "Estou passando mal, preciso de um hospital agora", step: 1 });
    expect(turn).toMatchObject({ status: "completed", policy: "health_urgency" });
    expect(turn.text).toContain("192");
    expect(alertsOf(turn)).toEqual(["health_urgency"]);
  });

  it("já fechou por fora: registra e encerra com cordialidade, sem contar como venda do corretor", () => {
    const turn = turnOf({ text: "Fechei com outra corretora", step: 1 });
    expect(turn).toMatchObject({ status: "completed", outcome: "other", policy: "closed_elsewhere" });
    expect(turn.answers.closed).toBe("no");
    expect(turn.answers.reason).toMatch(/Fechou com outro/);
  });

  it("desistiu (caso real 'deixa pra lá, muita demora'): encerra e alerta a reclamação", () => {
    const turn = turnOf({ text: "Tá bom deixa pra.la  muita demora", step: 2, prior: { contacted: true } });
    expect(turn).toMatchObject({ status: "completed", outcome: "other", policy: "gave_up" });
    expect(turn.text).toMatch(/^Sinto muito/);
    expect(alertsOf(turn)).toEqual(["broker_complaint"]);
  });

  it("R4: desistir é a própria resposta do motivo; o roteiro conclui com o motivo", () => {
    const turn = turnOf({ text: "Desisti, ficou caro", step: 1, rule: "R4" });
    expect(turn).toMatchObject({ status: "completed", outcome: "other", policy: "script" });
    expect(turn.answers.reason).toBe("Desisti, ficou caro");
  });

  it("pergunta fora do roteiro: acolhe em uma frase e repete a pergunta pendente", () => {
    const asked = turnOf({ text: "Sim", step: 1 });
    expect(asked.answers.lastQuestion).toMatch(/atendimento/);
    const held = turnOf({ text: "Vcs compram carência?", step: asked.step, prior: asked.answers });
    expect(held).toMatchObject({ status: "answering", step: asked.step, policy: "hold_question" });
    expect(held.text).toMatch(/dúvida/);
    expect(held.text).toContain(asked.answers.lastQuestion!);
    expect(alertsOf(held)).toEqual([]);
  });

  it("pergunta junto com resposta: acolhe e segue", () => {
    const turn = turnOf({ text: "Foi bom, nota 4. Vcs compram carência?", step: 2, prior: { contacted: true } });
    expect(turn).toMatchObject({ status: "answering", step: 3, policy: "script" });
    expect(turn.text).toMatch(/dúvida/);
  });

  it("opt-out e 'agora não' continuam como antes", () => {
    expect(turnOf({ text: "Pare de me mandar mensagem", step: 2 })).toMatchObject({ status: "opted_out" });
    expect(turnOf({ text: "Agora não", step: 0 })).toMatchObject({ status: "completed", outcome: "other" });
    expect(turnOf({ text: "Não quero mais", step: 0 })).toMatchObject({ status: "opted_out" });
  });

  it("caso real 'Foi 5, o problema é que agora não está dando' não vira atendimento ruim", () => {
    const turn = turnOf({ text: "Foi 5 o problema é q agora não está dando", step: 2, prior: { contacted: true }, answer: { rating: 5, sentiment: "negative" }, reading: { intents: [] } });
    expect(alertsOf(turn)).toEqual([]);
  });

  it("régua: pula o que já foi dito (R1 'falei com ele e foi rapidinho')", () => {
    const turn = turnOf({ text: "Falei com o Alan sim, foi rápido", step: 1, rule: "R1", answer: { contacted: true, speed: "fast" }, reading: { intents: [] } });
    expect(turn).toMatchObject({ status: "completed", outcome: "ok" });
  });

  it("varia o texto pela pesquisa e repete o mesmo texto na mesma pesquisa", () => {
    const texts = new Set(["a", "b", "c", "d", "e", "f"].map((seed) => turnOf({ text: "Pode perguntar", seed }).text));
    expect(texts.size).toBeGreaterThan(1);
    expect(turnOf({ text: "Pode perguntar", seed: "x" }).text).toBe(turnOf({ text: "Pode perguntar", seed: "x" }).text);
  });

  it("nenhum texto usa travessão, valor ou promessa de ligação", () => {
    const samples = [
      "Manda os valores por favor", "Me liga amanhã às 10h", "Número errado", "Estou passando mal agora",
      "Fechei com outra corretora", "Desisti", "Foi grosso comigo", "Vcs compram carência?", "Pode perguntar",
    ];
    for (const seed of ["s1", "s2", "s3"]) for (const text of samples) for (const step of [0, 1, 2]) {
      const turn = turnOf({ text, step, seed, prior: { contacted: true, lastQuestion: "Você chegou a receber uma cotação?" } });
      expect(turn.text).not.toContain(EM_DASH);
      expect(turn.text).not.toMatch(/R\$/);
      expect(turn.text).not.toMatch(/vamos te ligar|vai te ligar|ligaremos/i);
    }
  });
});

describe("R0 com intenções", () => {
  it("pedido de preço em outro assunto vira 'quer cotação' e alerta retomar", () => {
    const reading = detectPostSaleIntents("Qual o valor para 53 anos?");
    const answer = { ...classifyR0AnswerByKeywords("Qual o valor para 53 anos?"), category: "other_subject" as const };
    const turn = decideR0Turn({ answer, reading, names: { lead: "Ana", broker: "" } });
    expect(turn).toMatchObject({ outcome: "r0_wants_more", awaitsTeam: true, policy: "resume" });
    expect(turn.text).not.toMatch(/R\$|\d/);
  });

  it("número errado encerra sem esperar a equipe; urgência orienta o 192", () => {
    expect(decideR0Turn({ answer: { category: "other_subject" }, reading: detectPostSaleIntents("foi engano, não sou eu"), names })).toMatchObject({ wrongNumber: true, awaitsTeam: false, outcome: "other" });
    expect(decideR0Turn({ answer: { category: "other_subject" }, reading: detectPostSaleIntents("estou passando mal"), names }).text).toContain("192");
  });

  it("opt-out vence número errado", () => {
    expect(decideR0Turn({ answer: { category: "other_subject", optOut: true }, reading: { intents: ["wrong_person"] }, names })).toMatchObject({ status: "opted_out" });
  });
});

describe("Quem respondeu: chips e filtros novos", () => {
  it("mostra e filtra retomar, reclamação, dúvida, fechou por fora e número errado", () => {
    const row = (answers: Record<string, unknown>, outcome = "other") => ({ status: "completed", outcome, rating: null, answers });
    const resume = row({ intents: { list: ["price_request", "scheduling"], scheduleText: "amanhã às 10h" } }, "waiting");
    expect(answerChips(resume).map((c) => c.label)).toEqual(["Pediu valores", "Contato: amanhã às 10h"]);
    expect(responseGroups(resume)).toContain("wants_resume");
    expect(intentDetails(resume.answers)).toEqual(["Pediu contato: amanhã às 10h."]);
    const complaint = row({ contacted: true, intents: { list: ["complaint"], complaintKind: "rude", complaintQuote: "foi grosso" } });
    expect(responseGroups(complaint)).toEqual(expect.arrayContaining(["attended", "complaint"]));
    expect(intentDetails(complaint.answers)).toEqual(["Reclamação (grosseria): “foi grosso”"]);
    expect(responseGroups(row({ intents: { list: ["question"], questionTopic: "carencia" } }))).toEqual(["question"]);
    expect(answerChips(row({ intents: { list: ["question"], questionTopic: "carencia" } })).map((c) => c.label)).toEqual(["Dúvida: carência"]);
    expect(responseGroups(row({ closed: "no", intents: { list: ["closed", "closed_elsewhere"] } }))).toContain("closed_elsewhere");
    const r0 = { status: "completed", outcome: "r0_wants_more", rating: null, answers: { r0: { category: "wants_more" }, intents: { list: ["price_request"] } } };
    expect(answerChips(r0).map((c) => c.label)).toEqual(["Voltou a escrever", "Quer ajuda", "Pediu valores"]);
  });
});
