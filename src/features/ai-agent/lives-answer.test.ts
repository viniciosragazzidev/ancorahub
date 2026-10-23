import { describe, expect, it } from "vitest";

import { createEmptyMemory, extractFieldsFromMessage, pendingQuestionOf, readLivesAnswer, type ConversationMemory } from "./memory";
import { buildPrivateQualificationContext, isSingleLifeBusinessPlan, PME_SINGLE_LIFE_NOTE } from "@/features/qualification-engine/service";
import { composeQuestionReply } from "@/features/qualification-engine/reply-composer";

// Real case (21/10, PME): "Pode ser 1" was not read and the AI asked the lives question again.
const pmeAskedLives: ConversationMemory = {
  ...createEmptyMemory(),
  planType: { value: "empresarial", confidence: 1 },
  averageAge: { value: "53", confidence: 1 },
  collectedFields: ["planType", "age"],
  lastQuestionAsked: "Média de 53 anos, anotado. Quantas vidas vão entrar no plano, entre sócios, funcionários e dependentes?",
};
const familyAskedLives: ConversationMemory = {
  ...createEmptyMemory(),
  planType: { value: "familiar", confidence: 1 },
  collectedFields: ["planType"],
  lastQuestionAsked: "Quantas pessoas vão entrar no plano, contando com você?",
};

describe("short answers to the lives question", () => {
  it("reads \"Pode ser 1\" as 1 life on a PME (case 21/10)", () => {
    const updated = extractFieldsFromMessage("Pode ser 1", pmeAskedLives, "m1");
    expect(updated.numberOfLives).toMatchObject({ value: "1", confidence: 1, sourceMessageId: "m1" });
    expect(updated.collectedFields).toContain("numberOfLives");
  });

  it.each([
    ["pode ser 1", 1], ["Somente 1", 1], ["só 1", 1], ["1 pessoa", 1], ["somente eu", 1], ["Só eu mesmo", 1],
    ["eu e minha esposa", 2], ["Eu, minha esposa e meu filho", 3], ["eu e meus 2 filhos", 3],
    ["umas 3", 3], ["três", 3], ["seria 2", 2], ["Acho que 4 vidas", 4], ["5 por enquanto", 5], ["São 6 funcionários", 6],
  ])("%s → %i", (message, expected) => {
    expect(extractFieldsFromMessage(message, familyAskedLives).numberOfLives?.value).toBe(String(expected));
    expect(readLivesAnswer(message)).toBe(expected);
  });

  it("does not guess an unknown count or read prose as a quantity", () => {
    expect(readLivesAnswer("eu e meus filhos")).toBeUndefined();
    expect(readLivesAnswer("quanto custa?")).toBeUndefined();
    expect(extractFieldsFromMessage("eu e meus filhos", familyAskedLives).numberOfLives).toBeUndefined();
    // Out of the lives question these are not quantities.
    expect(extractFieldsFromMessage("seria 2", { ...createEmptyMemory(), lastQuestionAsked: "Qual é o seu nome completo?" }).numberOfLives).toBeUndefined();
    expect(extractFieldsFromMessage("pode ser 1", { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você vai usar o plano?" }).numberOfLives).toBeUndefined();
  });

  it("moves on after a 1-life PME answer and warns the broker instead of re-asking", () => {
    const updated = extractFieldsFromMessage("Pode ser 1", pmeAskedLives, "m1");
    expect(isSingleLifeBusinessPlan(updated)).toBe(true);
    expect(buildPrivateQualificationContext(updated).facts).toContain(PME_SINGLE_LIFE_NOTE);
    const reply = composeQuestionReply({ key: "city", memory: updated, answered: ["numberOfLives"], seed: "s" });
    expect(reply).toMatch(/^(1 vida, anotado!|Beleza, 1 vida\.)/);
    expect(reply).not.toMatch(/quantas vidas/i);
  });
});

describe("the pending question stored after a reply", () => {
  const lateralThenQuestion = "O valor depende principalmente da idade, da cidade e do tipo de plano. Com essas respostas o corretor já te manda os valores.\n\nQuantas vidas vão entrar no plano, entre sócios, funcionários e dependentes?";

  it("keeps only the question, not the lateral answer or greeting before it", () => {
    expect(pendingQuestionOf(lateralThenQuestion)).toBe("Quantas vidas vão entrar no plano, entre sócios, funcionários e dependentes?");
    expect(pendingQuestionOf("Qual é o seu nome completo?")).toBe("Qual é o seu nome completo?");
  });

  it("does not read a price quote as ages after a lateral answer that mentions \"idade\" (case 21/10)", () => {
    const memory: ConversationMemory = {
      ...createEmptyMemory(),
      planType: { value: "empresarial", confidence: 1 },
      collectedFields: ["planType"],
      lastQuestionAsked: pendingQuestionOf(lateralThenQuestion),
    };
    const updated = extractFieldsFromMessage("Ali diz q a partir de 59 é 529,47", memory);
    expect(updated.averageAge).toBeUndefined();
    expect(updated.numberOfLives).toBeUndefined();
  });
});
