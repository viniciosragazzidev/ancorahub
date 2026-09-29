import { describe, expect, it } from "vitest";

import { shouldHoldDisqualifiedLead } from "./disqualified-routing-settings";

describe("shouldHoldDisqualifiedLead", () => {
  it("mantém o lead em espera quando a chave global está ativa", () => {
    expect(shouldHoldDisqualifiedLead({ holdDisqualifiedLeads: true })).toBe(true);
    expect(
      shouldHoldDisqualifiedLead({ holdDisqualifiedLeads: true, matchedRuleMode: "automatic" }),
    ).toBe(true);
  });

  it("não bloqueia quando a chave está desligada", () => {
    expect(shouldHoldDisqualifiedLead({ holdDisqualifiedLeads: false })).toBe(false);
  });

  it("permite a exceção de uma regra manual explícita", () => {
    expect(
      shouldHoldDisqualifiedLead({ holdDisqualifiedLeads: true, matchedRuleMode: "manual" }),
    ).toBe(false);
  });
});
