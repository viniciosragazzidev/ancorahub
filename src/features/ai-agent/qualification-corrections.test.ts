import { describe, expect, it } from "vitest";

import { createEmptyMemory, type ConversationMemory } from "./memory";
import { applyQualificationCorrectionsToMemory, describeQualificationCorrections, detectQualificationCorrections } from "./qualification-corrections";
import { summarizeQualification } from "@/features/qualification-engine/reply-composer";

// What was registered in Fabiane's conversation before she corrected it.
const registered: ConversationMemory = {
  ...createEmptyMemory(),
  planType: { value: "empresarial", confidence: 1 },
  numberOfLives: { value: "12", confidence: 1 },
  age: { value: "42", confidence: 1 },
  averageAge: { value: "42", confidence: 1 },
  email: { value: "fabianesantoro@yahoo.com.br", confidence: 1 },
};

describe("a correction after the qualification", () => {
  it("reads Fabiane's correction: 2 lives, aged 12 and 42", () => {
    const corrections = detectQualificationCorrections(registered, "Não,\n12anos e 42 anos\n2 vidas");
    expect(corrections).toEqual([
      { field: "numberOfLives", value: "2" },
      { field: "age", value: "12, 42" },
      { field: "averageAge", value: "27" },
    ]);
    expect(describeQualificationCorrections(corrections)).toBe("2 vidas; idades 12, 42 (média 27)");
  });

  it("does not read small talk as new data", () => {
    expect(detectQualificationCorrections(registered, "Obrigada!")).toEqual([]);
    expect(detectQualificationCorrections(registered, "faz 2 anos que tenho plano")).toEqual([]);
    expect(detectQualificationCorrections(registered, "ok, aguardo")).toEqual([]);
  });

  it("takes a new e-mail, and ignores the same data said again", () => {
    expect(detectQualificationCorrections(registered, "manda pra outro@exemplo.com")).toEqual([{ field: "email", value: "outro@exemplo.com" }]);
    expect(detectQualificationCorrections(registered, "Fabianesantoro@yahoo.com.br")).toEqual([]);
    expect(detectQualificationCorrections({ ...registered, numberOfLives: { value: "2", confidence: 1 } }, "são 2 vidas")).toEqual([]);
  });

  it("applies corrected ages before mapping the optional relationships and keeps the handoff summary clean", () => {
    const family: ConversationMemory = {
      ...createEmptyMemory(),
      planType: { value: "familiar", confidence: 1 },
      numberOfLives: { value: "2", confidence: 1 },
      age: { value: "35, 32", confidence: 1 },
      relationAsked: true,
    };
    const message = "Não, na verdade eu tenho 46 anos e meu filho tem 10 anos";
    const corrections = detectQualificationCorrections(family, message);
    const { memory, beneficiaryCapture } = applyQualificationCorrectionsToMemory({
      memory: family,
      corrections,
      message,
      sourceMessageId: "message-1",
    });

    expect(corrections).toContainEqual({ field: "age", value: "46, 10" });
    expect(memory.age?.value).toBe("46, 10");
    expect(beneficiaryCapture?.status).toBe("mapped");
    expect(memory.beneficiaries?.map(({ age, relation }) => [age, relation])).toEqual([[46, "titular"], [10, "filho"]]);
    expect(summarizeQualification({ ...memory, beneficiaryRaw: "minha filha Ana, 10" })).toBe("familiar, você 46 e filho 10 anos");
  });

  it("treats a changed age list with relationships as a correction after the relation prompt", () => {
    const family: ConversationMemory = {
      ...createEmptyMemory(),
      planType: { value: "familiar", confidence: 1 },
      numberOfLives: { value: "2", confidence: 1 },
      age: { value: "35, 32", confidence: 1 },
      relationAsked: true,
    };
    const message = "Tenho 46 anos e meu filho tem 10 anos";
    const corrections = detectQualificationCorrections(family, message);
    const { memory, beneficiaryCapture } = applyQualificationCorrectionsToMemory({ memory: family, corrections, message });

    expect(corrections).toContainEqual({ field: "age", value: "46, 10" });
    expect(beneficiaryCapture?.status).toBe("ambiguous");
    expect(describeQualificationCorrections(corrections)).toContain("idades 46, 10");
    expect(memory.beneficiaries?.every(({ relation }) => relation === null)).toBe(true);
    expect(summarizeQualification(memory, ["age"])).toBe("46 e 10 anos");
  });
});
