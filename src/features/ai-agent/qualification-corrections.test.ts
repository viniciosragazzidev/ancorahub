import { describe, expect, it } from "vitest";

import { createEmptyMemory, type ConversationMemory } from "./memory";
import { describeQualificationCorrections, detectQualificationCorrections } from "./qualification-corrections";

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
});
