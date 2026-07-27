import { describe, expect, it } from "vitest";

import { RepeatedQuestionGuard } from "./guardrails";
import { buildMemoryContext, createEmptyMemory } from "./memory";
import { createSafeFallbackResponse } from "./ai-response-schema";

describe("RepeatedQuestionGuard recovery", () => {
  it("blocks the repeated field while the safe fallback advances the conversation", () => {
    const memory = createEmptyMemory();
    memory.collectedFields = ["customerName"];
    memory.customerName = { value: "Maria Silva", confidence: 1 };

    const result = new RepeatedQuestionGuard().check({
      response: {
        message: "Qual é o seu nome?",
        language: "pt-BR",
        detectedIntent: "collecting_info",
        shouldTransfer: false,
        shouldWait: true,
        questionAsked: { field: "customerName", text: "Qual é o seu nome?" },
      },
      rawText: "Qual é o seu nome?",
      memory,
      conversationStatus: "WAITING_CUSTOMER",
      tenantId: "tenant-test",
      conversationId: "conversation-test",
      userMessage: "Tenho interesse",
      collectedFieldsBefore: memory.collectedFields,
    });

    expect(result).toMatchObject({ passed: false, code: "REPEATED_QUESTION" });
    const fallback = createSafeFallbackResponse(memory.customerName.value, buildMemoryContext(memory));
    expect(fallback.message).toBeTruthy();
    expect(fallback.message).not.toContain("Qual é o seu nome?");
  });

  it("advances to the next missing field with the current memory format", () => {
    const memory = createEmptyMemory();
    memory.collectedFields = ["customerName", "planType"];
    memory.customerName = { value: "Maria Silva", confidence: 1 };
    memory.planType = { value: "individual", confidence: 1 };

    const fallback = createSafeFallbackResponse(
      memory.customerName.value,
      buildMemoryContext(memory),
    );

    expect(fallback.message).toMatch(/cidade/i);
    expect(fallback.questionAsked?.field).toBe("city");
  });
});
