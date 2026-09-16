import { describe, it, expect } from "vitest";
import { evaluateLeadAgainstConditions } from "./routing-engine";
import { ALL_ROUTING_SOURCES_ID } from "./routing-catalog";

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

  it("does not route a disqualified lead through a global rule", () => {
    const result = evaluateLeadAgainstConditions({}, { qualificationStatus: "disqualified" });
    expect(result.matches).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("desqualificado"))).toBe(true);
  });

  it("routes a disqualified lead only when explicitly selected", () => {
    const result = evaluateLeadAgainstConditions({ qualificationStatuses: ["disqualified"] }, { qualificationStatus: "disqualified" });
    expect(result.matches).toBe(true);
  });

  it("normalizes the canonical Meta Lead Ads source and legacy alias", () => {
    const canonical = evaluateLeadAgainstConditions({ sources: ["meta_lead_ads"] }, { source: "meta_ads" });
    const legacy = evaluateLeadAgainstConditions({ sources: ["meta_ads"] }, { source: "meta_lead_ads" });
    expect(canonical.matches).toBe(true);
    expect(legacy.matches).toBe(true);
  });

  it("matches every source when Todas as origens is selected", () => {
    const result = evaluateLeadAgainstConditions(
      { sources: [ALL_ROUTING_SOURCES_ID] },
      { source: "whatsapp" },
    );
    expect(result.matches).toBe(true);
  });
});
