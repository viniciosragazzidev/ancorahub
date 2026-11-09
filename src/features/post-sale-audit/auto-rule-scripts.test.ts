import { describe, expect, it } from "vitest";

import { autoRuleNextTurn, autoRuleQuestionFocus, detectAutoRuleKeywords } from "./auto-rule-scripts";
import { AUTO_RULE_KEYS, type AutoRuleKey } from "./auto-rules";
import type { PostSaleAnswers } from "./conversation-rules";

const EM_DASH = String.fromCharCode(0x2014);
const names = { lead: "Maria", broker: "João" };

/** Simula a conversa usando só as palavras-chave (caminho de quando a IA falha). */
function talk(rule: AutoRuleKey, replies: string[]) {
  let step = 0;
  let answers: PostSaleAnswers = {};
  const turns = [];
  for (const reply of replies) {
    const focus = autoRuleQuestionFocus(rule, step, answers);
    const answer = detectAutoRuleKeywords(reply, focus);
    const turn = autoRuleNextTurn(rule, step, answers, answer, names);
    turns.push(turn);
    step = turn.step;
    answers = turn.answers;
    if (turn.status !== "answering") break;
  }
  return turns;
}

describe("roteiros da régua", () => {
  it("R1: falou com o corretor e foi rápido", () => {
    const turns = talk("R1", ["Pode perguntar", "sim", "sim"]);
    expect(turns[0].text).toContain("João");
    expect(turns[1].text).toMatch(/rápido/);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "ok" });
    expect(turns.at(-1)!.answers).toMatchObject({ contacted: true, speed: "fast" });
  });

  it("R1: demorou vira atendimento ruim; ninguém falou vira sem contato", () => {
    expect(talk("R1", ["Pode perguntar", "sim", "não"]).at(-1)).toMatchObject({ status: "completed", outcome: "bad_service" });
    const noContact = talk("R1", ["Pode perguntar", "não", "sim"]);
    expect(noContact[1].text).toMatch(/ajuda/);
    expect(noContact.at(-1)).toMatchObject({ status: "completed", outcome: "no_contact" });
    expect(noContact.at(-1)!.answers.wantsHelp).toBe(true);
  });

  it("R2: recebeu cotação, fechou e deu nota", () => {
    const turns = talk("R2", ["Pode perguntar", "sim", "fechei, nota 5"]);
    expect(turns[0].text).toMatch(/cotação/);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "closed" });
    expect(turns.at(-1)!.answers).toMatchObject({ receivedQuote: true, closed: "yes", rating: 5 });
  });

  it("R2: sem cotação pergunta se quer ajuda", () => {
    const turns = talk("R2", ["Pode perguntar", "não", "sim"]);
    expect(turns[1].text).toMatch(/ajuda/);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "waiting" });
  });

  it("R3: contratação e dúvida", () => {
    const turns = talk("R3", ["Pode perguntar", "foi ótimo, nota 5", "sim"]);
    expect(turns[1].text).toMatch(/dúvida/);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "closed" });
    expect(turns.at(-1)!.answers).toMatchObject({ rating: 5, wantsHelp: true, closed: "yes" });
    expect(talk("R3", ["Pode perguntar", "ruim, nota 2", "não"]).at(-1)).toMatchObject({ outcome: "bad_service" });
  });

  it("R4: guarda o motivo dito pelo cliente", () => {
    const turns = talk("R4", ["Pode perguntar", "Achei caro e a carência era longa"]);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "other" });
    expect(turns.at(-1)!.answers.reason).toBe("Achei caro e a carência era longa");
  });

  it("R5: tudo certo e indicaria", () => {
    const turns = talk("R5", ["Pode perguntar", "sim", "indicaria sim"]);
    expect(turns[1].text).toMatch(/indicaria/);
    expect(turns.at(-1)).toMatchObject({ status: "completed", outcome: "ok" });
    expect(turns.at(-1)!.answers).toMatchObject({ sentiment: "positive", recommends: true });
    const problem = talk("R5", ["Pode perguntar", "não, tive problema com o reembolso", "sim"]);
    expect(problem[1].text).toMatch(/ajude/);
    expect(problem.at(-1)).toMatchObject({ outcome: "bad_service" });
    expect(problem.at(-1)!.answers.wantsHelp).toBe(true);
  });

  it("em qualquer regra, pedir para parar encerra e recusar a apresentação agradece", () => {
    for (const rule of AUTO_RULE_KEYS) {
      expect(talk(rule, ["pare de me mandar mensagem"])[0]).toMatchObject({ status: "opted_out" });
      expect(talk(rule, ["Agora não"])[0]).toMatchObject({ status: "completed", outcome: "other" });
    }
  });

  it("uma pergunta por mensagem, sem preço e sem travessão", () => {
    for (const rule of AUTO_RULE_KEYS) {
      for (const replies of [["Pode perguntar", "sim", "sim", "sim"], ["Pode perguntar", "não", "não", "não"]]) {
        for (const turn of talk(rule, replies)) {
          expect(turn.text).not.toContain(EM_DASH);
          expect(turn.text).not.toMatch(/R\$|preço|valor/i);
          expect((turn.text.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
