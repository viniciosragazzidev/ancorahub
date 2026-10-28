import { describe, expect, it } from "vitest";

import { evaluateQualification } from "@/features/qualification-engine/service";

import { createEmptyMemory, extractFieldsFromMessage, extractUnansweredMessages, hasQuoteReadyData, pendingQuestionsOf, type ConversationMemory, type MemoryField } from "./memory";

const field = (value: string): MemoryField => ({ value, confidence: 1, sourceMessageId: "m1" });
const CITY_THEN_PLAN = "Em qual cidade e bairro você mora?\n\nE hoje você tem algum plano de saúde?";
const PLAN_ONLY = "E hoje você tem algum plano de saúde?";

/** Plan type, lives and ages given: the quote data, without the city. */
function quoteDataMemory(extra: Partial<ConversationMemory> = {}): ConversationMemory {
  return {
    ...createEmptyMemory(),
    planType: field("individual"),
    numberOfLives: field("1"),
    age: field("30"),
    ...extra,
  };
}

describe("city before hot (28/10)", () => {
  it("quote data without the city is not hot", () => {
    const memory = quoteDataMemory();
    expect(hasQuoteReadyData(memory)).toBe(false);
    expect(evaluateQualification(memory).qualificationStatus).not.toBe("hot");
  });

  it("quote data plus the city is hot", () => {
    const memory = quoteDataMemory({ city: field("Petrópolis") });
    expect(hasQuoteReadyData(memory)).toBe(true);
    expect(evaluateQualification(memory).qualificationStatus).toBe("hot");
  });
});

describe("city answer read when the city question is not the last paragraph (28/10)", () => {
  it("keeps every question paragraph of the reply", () => {
    expect(pendingQuestionsOf(CITY_THEN_PLAN)).toBe(["Em qual cidade e bairro você mora?", "E hoje você tem algum plano de saúde?"].join("\n"));
    expect(pendingQuestionsOf("Ótimo, anotado.")).toBe("Ótimo, anotado.");
  });

  it("reads the city joined to the neighbourhood by a comma without a space (case Mary)", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: PLAN_ONLY, lastQuestionsAsked: CITY_THEN_PLAN };
    const next = extractFieldsFromMessage("Petrópolis,Duarte da Silveira", memory, "m2");
    expect(next.city?.value).toBe("Petrópolis");
  });

  it.each([
    ["Petrópolis, Duarte da Silveira", "Petrópolis"],
    ["Petrópolis/RJ", "Petrópolis"],
    ["Petrópolis - RJ", "Petrópolis"],
    ["Petrópolis,Duarte da Silveira", "Petrópolis"],
  ])("reads the city from %s", (message, city) => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: PLAN_ONLY, lastQuestionsAsked: CITY_THEN_PLAN };
    expect(extractFieldsFromMessage(message, memory, "m2").city?.value).toBe(city);
  });

  it("reads the city from a location phrase without any city question", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: PLAN_ONLY };
    expect(extractFieldsFromMessage("moro em Petrópolis", memory, "m2").city?.value).toBe("Petrópolis");
  });

  it("does not take a lateral answer as the city", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: PLAN_ONLY, lastQuestionsAsked: CITY_THEN_PLAN };
    expect(extractFieldsFromMessage("Estou saindo p dar aulas", memory, "m2").city).toBeUndefined();
  });

  it("does not read a city out of a reply that asked no city", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: PLAN_ONLY, lastQuestionsAsked: PLAN_ONLY };
    expect(extractFieldsFromMessage("Petrópolis/RJ", memory, "m2").city).toBeUndefined();
  });
});

describe("a batch of messages after the AI's last question is read in order (28/10)", () => {
  // The real reply of 28/10 (Mary, fe76a774): one paragraph asking the city and the current plan.
  const CITY_AND_PLAN = "Ótimo, então é pra família! Pra fechar a cotação, em qual cidade e bairro você mora? Se vocês já têm plano de saúde hoje, me conta qual, que eu comparo pra vocês.";

  it("reads the city and the plan from two messages sent before the reply", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: CITY_AND_PLAN, lastQuestionsAsked: CITY_AND_PLAN };
    const next = extractUnansweredMessages(memory, [
      { body: "Petrópolis,Duarte da Silveira", messageId: "m1" },
      { body: "Não tenho plano de saúde", messageId: "m2" },
    ]);
    expect(next.city?.value).toBe("Petrópolis");
    expect(next.neighborhood?.value).toBe("Duarte da Silveira");
    expect(next.currentPlan).toBeDefined();
    expect(next.lastQuestionAsked).toBe(CITY_AND_PLAN);
  });

  it("the city stays lost when the batch is read without the question (the old behaviour)", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: undefined, lastQuestionsAsked: undefined };
    expect(extractFieldsFromMessage("Petrópolis,Duarte da Silveira", memory, "m1").city).toBeUndefined();
  });

  it("keeps the first city when a later message repeats another place", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: CITY_AND_PLAN, lastQuestionsAsked: CITY_AND_PLAN };
    const next = extractUnansweredMessages(memory, [
      { body: "Petrópolis, RJ", messageId: "m1" },
      { body: "moro em Niterói", messageId: "m2" },
    ]);
    expect(next.city?.value).toBe("Petrópolis");
  });
});
