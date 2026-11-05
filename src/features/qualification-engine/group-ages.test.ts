import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => { throw new Error("no database in unit tests"); }, schema: {} }));

import { buildMemoryContext, createEmptyMemory, extractFieldsFromMessage } from "@/features/ai-agent/memory";
import { describeQualificationCorrections } from "@/features/ai-agent/qualification-corrections";
import { confirmationVariants, summarizeQualification } from "./reply-composer";
import { buildPrivateQualificationContext } from "./service";

/** Vinicios, 04/11/2026: for a company the AI answered "Média de 27 anos"; it must repeat every age the customer gave. */
describe("idades de um plano empresarial", () => {
  const memory = extractFieldsFromMessage("6, 48 e 71", {
    ...createEmptyMemory(),
    planType: { value: "empresarial", confidence: 1 },
    numberOfLives: { value: "3", confidence: 1 },
    lastQuestionAsked: "Quais as idades de cada pessoa que vai entrar no plano?",
  }, "msg-ages");

  it("guarda todas as idades e deixa a média só como número interno", () => {
    expect(memory.age?.value).toBe("6, 48, 71");
    expect(memory.averageAge?.value).toBe("42");
  });

  it("confirma e resume com todas as idades, nunca com a média", () => {
    const texts = [...confirmationVariants("age", memory), summarizeQualification(memory), buildMemoryContext(memory), buildPrivateQualificationContext(memory)].join("\n");
    expect(texts).toContain("6, 48 e 71");
    expect(texts).not.toMatch(/m[ée]dia de/i);
  });

  it("a correção também lista as idades sem média", () => {
    expect(describeQualificationCorrections([{ field: "age", value: "6, 48, 71" }, { field: "averageAge", value: "42" }])).toBe("idades 6, 48 e 71");
  });

  it("quando o cliente só dá a média, a média continua valendo", () => {
    const onlyAverage = { ...createEmptyMemory(), planType: { value: "empresarial", confidence: 1 as const }, averageAge: { value: "35", confidence: 1 as const } };
    expect(confirmationVariants("age", onlyAverage)[0]).toBe("Média de 35 anos, anotado. Obrigado!");
  });
});
