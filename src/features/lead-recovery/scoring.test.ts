import { describe, expect, it } from "vitest";

import { goesStraightToBroker, interestPoints, scoreInputFromMemory, scoreLead } from "./scoring";

const now = new Date("2026-11-21T17:00:00Z");

describe("scoreLead", () => {
  it("empresarial com vidas, idades e cidade atendida, que respondeu rápido e pediu ligação: A4", () => {
    const score = scoreLead({ now, planType: "empresarial", lives: 6, agesInformed: true, cityServed: true, replied: true, firstReplyMinutes: 4, askedForCall: true, lastInteractionAt: now });
    expect(score.label).toBe("A4");
    expect(goesStraightToBroker(score)).toBe(true);
  });

  it("familiar sem idades, respondeu tarde: B2", () => {
    expect(scoreLead({ now, planType: "familiar", lives: 3, cityServed: true, replied: true, firstReplyMinutes: 300, lastInteractionAt: now }).label).toBe("B2");
  });

  it("sem dado nenhum: D1", () => {
    expect(scoreLead({ now }).label).toBe("D1");
  });

  it("fora do perfil vai para D mesmo com pontos", () => {
    expect(scoreLead({ now, planType: "empresarial", lives: 10, agesInformed: true, outOfProfile: true }).profile).toBe("D");
  });

  it("interesse perde 25% por semana sem interação", () => {
    const base = { now, replied: true, firstReplyMinutes: 5, askedForCall: true };
    expect(interestPoints({ ...base, lastInteractionAt: now })).toBe(55);
    expect(interestPoints({ ...base, lastInteractionAt: new Date(now.getTime() - 15 * 86_400_000) })).toBe(31);
  });

  it("ordena perfil antes de interesse", () => {
    const a1 = scoreLead({ now, planType: "empresarial", lives: 5, agesInformed: true });
    const b4 = scoreLead({ now, planType: "familiar", lives: 2, replied: true, firstReplyMinutes: 1, askedForCall: true, lastInteractionAt: now });
    expect(a1.rank).toBeGreaterThan(b4.rank);
  });

  it("lê a memória sem nenhum campo de saúde", () => {
    expect(scoreInputFromMemory({ planType: { value: "empresarial" }, numberOfLives: { value: "4" }, averageAge: { value: "38" }, companyHasCnpj: { value: "sim" } }))
      .toEqual({ planType: "empresarial", companyHasCnpj: true, lives: 4, agesInformed: true });
  });
});
