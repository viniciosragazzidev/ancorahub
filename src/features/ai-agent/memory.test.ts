import { describe, expect, it } from "vitest";

import { createEmptyMemory, extractFieldsFromMessage, isCoreQualificationComplete, COLLECTIBLE_FIELDS } from "./memory";

describe("conversation memory", () => {
  it("records a bare number as lives when it answers the last lives question", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Quantas vidas serão incluídas no plano?" };

    const updated = extractFieldsFromMessage("3", memory, "msg-3");

    expect(updated.numberOfLives).toMatchObject({ value: "3", confidence: 1, sourceMessageId: "msg-3" });
    expect(updated.collectedFields).toContain("numberOfLives");
  });

  it("understands pessoa física as an individual plan", () => {
    const updated = extractFieldsFromMessage(
      "Pessoa física",
      createEmptyMemory(),
      "msg-plan-type",
    );

    expect(updated.planType).toMatchObject({
      value: "individual",
      confidence: 1,
      sourceMessageId: "msg-plan-type",
    });
    expect(updated.collectedFields).toContain("planType");
  });

  it("captures a bare city answer when the previous question asks for city", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você mora?" };
    const updated = extractFieldsFromMessage("Nova Iguaçu, RJ", memory, "msg-city");

    expect(updated.city).toMatchObject({ value: "Nova Iguaçu", confidence: 1 });
    expect(updated.collectedFields).toContain("city");
  });

  it("captures all ages supplied together for a family", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Qual é a idade da pessoa que será incluída?" };
    const updated = extractFieldsFromMessage("13,33,36", memory, "msg-ages");

    expect(updated.age).toMatchObject({ value: "13, 33, 36", confidence: 1 });
    expect(updated.collectedFields).toContain("age");
  });

  it("keeps the six-question qualification order and detects completion", () => {
    expect(COLLECTIBLE_FIELDS.slice(0, 6).map((field) => field.key)).toEqual([
      "customerName", "planType", "numberOfLives", "age", "city", "email",
    ]);
    const memory = {
      ...createEmptyMemory(),
      customerName: { value: "Maria Silva", confidence: 1 as const },
      planType: { value: "familiar", confidence: 1 as const },
      numberOfLives: { value: "3", confidence: 1 as const },
      age: { value: "13, 33, 36", confidence: 1 as const },
      city: { value: "Nova Iguaçu", confidence: 1 as const },
      email: { value: "maria@example.com", confidence: 1 as const },
    };
    expect(isCoreQualificationComplete(memory)).toBe(true);
  });
});
