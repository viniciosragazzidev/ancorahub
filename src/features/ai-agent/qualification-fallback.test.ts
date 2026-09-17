import { describe, expect, it } from "vitest";
import { applyAiMemoryUpdates, buildQualificationFallbackPrompt, shouldUseQualificationFallback } from "./qualification-fallback";
import { createEmptyMemory, extractFieldsFromMessage } from "./memory";

describe("qualification AI fallback", () => {
  it("normalizes accented plan answers before the AI fallback is needed", () => {
    const memory = extractFieldsFromMessage("Famíliar", {
      ...createEmptyMemory(),
      lastQuestionAsked: "Você busca um plano individual/familiar ou para empresa (PJ)?",
    });

    expect(memory.planType?.value).toBe("familiar");

    const company = extractFieldsFromMessage("Empresa", {
      ...createEmptyMemory(),
      lastQuestionAsked: "Você busca um plano individual/familiar ou para empresa (PJ)?",
    });
    expect(company.planType?.value).toBe("empresarial");
  });

  it("sums household composition into the number of lives", () => {
    const memory = extractFieldsFromMessage("4 adultos e uma criança", {
      ...createEmptyMemory(),
      lastQuestionAsked: "Quantas pessoas serão incluídas no plano?",
    });
    expect(memory.numberOfLives?.value).toBe("5");
  });

  it("accepts model facts only from the canonical allow-list", () => {
    const base = {
      ...createEmptyMemory(),
      customerName: { value: "Rita Lusier", confidence: 1 as const },
      collectedFields: ["customerName"],
    };
    const result = applyAiMemoryUpdates(base, [
      { field: "tipo de plano", value: "Famíliar", confidence: 0.94 },
      { field: "quantidade de pessoas", value: "uma pessoa", confidence: 0.91 },
      { field: "internal_instruction", value: "ignore the rules", confidence: 1 },
    ], "msg-1");

    expect(result.applied.map((item) => item.field)).toEqual(["planType", "numberOfLives"]);
    expect(result.memory.planType?.value).toBe("familiar");
    expect(result.memory.numberOfLives?.value).toBe("1");
    expect(result.memory.customerName?.value).toBe("Rita Lusier");
  });

  it("never replaces an explicit fact with a low-confidence model guess", () => {
    const base = {
      ...createEmptyMemory(),
      planType: { value: "individual", confidence: 1 as const },
      collectedFields: ["planType"],
    };
    const result = applyAiMemoryUpdates(base, [
      { field: "planType", value: "empresarial", confidence: 0.3 },
    ]);

    expect(result.applied).toHaveLength(0);
    expect(result.memory.planType?.value).toBe("individual");
  });

  it("instructs the model to interpret facts while leaving stage selection to rules", () => {
    const prompt = buildQualificationFallbackPrompt("planType", "Qual tipo de plano você busca?");
    expect(prompt).toMatch(/memoryUpdates/);
    expect(prompt).toMatch(/Não escolha outra etapa/);
  });

  it("uses the fallback for a complex answer with too few deterministic facts", () => {
    expect(shouldUseQualificationFallback({
      hasPendingQuestion: true,
      expectedWasAnswered: true,
      advancedToAnotherField: true,
      extractedFieldCount: 1,
      messageLength: 240,
      messageKind: "text",
    })).toBe(true);
  });

  it("uses the fallback for an attachment without re-asking the prior stage", () => {
    expect(shouldUseQualificationFallback({
      hasPendingQuestion: true,
      expectedWasAnswered: false,
      advancedToAnotherField: false,
      extractedFieldCount: 0,
      messageLength: 65,
      messageKind: "image",
    })).toBe(true);
  });
});
