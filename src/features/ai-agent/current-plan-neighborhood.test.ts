import { describe, expect, it } from "vitest";

import { composeQuestionReply } from "@/features/qualification-engine/reply-composer";

import { asksCurrentPlan, createEmptyMemory, extractFieldsFromMessage, hasCoreQuoteData, readCurrentPlan, readNeighborhood } from "./memory";
import { qualificationTimeoutOutcome } from "./qualification-timeout-policy";

describe("neighbourhood with the city (23/10)", () => {
  it("reads the neighbourhood next to the city", () => {
    expect(readNeighborhood("Niterói, Icaraí", "Niterói")).toBe("Icaraí");
    expect(readNeighborhood("Icaraí - Niterói", "Niterói")).toBe("Icaraí");
    expect(readNeighborhood("moro em Niterói no bairro Fonseca", "Niterói")).toBe("Fonseca");
    expect(readNeighborhood("Niterói", "Niterói")).toBeNull();
  });

  it("fills city and neighbourhood from one answer", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade e bairro você mora? Assim já busco opções com hospitais pertinho de você." };
    const updated = extractFieldsFromMessage("Niterói, Icaraí", memory, "m1");
    expect(updated.city?.value).toBe("Niterói");
    expect(updated.neighborhood?.value).toBe("Icaraí");
  });
});

describe("already has a plan (23/10)", () => {
  it("reads the answer and never a decline", () => {
    expect(readCurrentPlan("já tenho Amil")).toBe("Tem plano: Amil");
    expect(readCurrentPlan("Não tenho")).toBe("Não tem plano");
    expect(readCurrentPlan("não, nenhum")).toBe("Não tem plano");
    expect(readCurrentPlan("temos um plano pela empresa")).toBe("Tem plano");
    expect(readCurrentPlan("joao@gmail.com")).toBeNull();
    expect(readCurrentPlan("não sei")).toBeNull();
  });

  it("asks it together with the last question, once", () => {
    const memory = { ...createEmptyMemory(), planType: { value: "familiar", confidence: 1 as const }, numberOfLives: { value: "2", confidence: 1 as const } };
    const reply = composeQuestionReply({ key: "email", memory, answered: [], seed: "s", last: true, askCurrentPlan: true });
    expect(reply).toMatch(/^Pra fechar: /);
    expect(asksCurrentPlan(reply)).toBe(true);
    expect(reply).toMatch(/vocês/);
    const next = extractFieldsFromMessage("ana@gmail.com, temos Amil", { ...memory, lastQuestionAsked: reply }, "m2");
    expect(next.email?.value).toBe("ana@gmail.com");
    expect(next.currentPlan?.value).toBe("Tem plano: Amil");
  });
});

describe("hot once it can be quoted (23/10)", () => {
  it("needs plan type, lives and ages", () => {
    const base = createEmptyMemory();
    expect(hasCoreQuoteData({ ...base, planType: { value: "familiar", confidence: 1 }, numberOfLives: { value: "2", confidence: 1 } })).toBe(false);
    expect(hasCoreQuoteData({ ...base, planType: { value: "familiar", confidence: 1 }, numberOfLives: { value: "2", confidence: 1 }, age: { value: "75, 71", confidence: 1 } })).toBe(true);
    expect(hasCoreQuoteData({ ...base, planType: { value: "individual", confidence: 1 }, age: { value: "40", confidence: 1 } })).toBe(true);
    expect(hasCoreQuoteData({ ...base, planType: { value: "empresarial", confidence: 1 }, numberOfLives: { value: "5", confidence: 1 }, averageAge: { value: "35", confidence: 1 } })).toBe(true);
  });

  it("a conversation that stops after that point stays hot, not cold", () => {
    const memory = { ...createEmptyMemory(), planType: { value: "individual", confidence: 1 as const }, age: { value: "40", confidence: 1 as const } };
    expect(qualificationTimeoutOutcome(memory, []).qualificationStatus).toBe("hot");
  });
});
