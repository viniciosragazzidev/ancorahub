import { describe, it, expect } from "vitest";
import { evaluateLeadAgainstConditions } from "./routing-engine";

describe("Routing Engine - evaluateLeadAgainstConditions", () => {
  it("returns match when lead matches planType and minLives conditions", () => {
    const conditions = {
      planTypes: ["pme", "empresarial"],
      minLives: 5,
    };
    const lead = {
      planType: "pme",
      lives: 10,
    };

    const result = evaluateLeadAgainstConditions(conditions, lead);
    expect(result.matches).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });

  it("fails match when lead lives count is below minLives", () => {
    const conditions = {
      minLives: 10,
    };
    const lead = {
      lives: 2,
    };

    const result = evaluateLeadAgainstConditions(conditions, lead);
    expect(result.matches).toBe(false);
    expect(result.reasons.some((r) => r.includes("abaixo do mínimo"))).toBe(true);
  });

  it("matches source and city case-insensitively", () => {
    const conditions = {
      sources: ["meta_ads"],
      cities: ["São Paulo"],
    };
    const lead = {
      source: "Meta_Ads",
      city: "são paulo",
    };

    const result = evaluateLeadAgainstConditions(conditions, lead);
    expect(result.matches).toBe(true);
  });
});
