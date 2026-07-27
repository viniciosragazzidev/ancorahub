import { describe, expect, it } from "vitest";

import { createEmptyMemory, extractFieldsFromMessage } from "./memory";

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
});
