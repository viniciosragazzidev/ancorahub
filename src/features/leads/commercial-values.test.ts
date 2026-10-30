import { describe, expect, it } from "vitest";

import {
  commercialValuesAuditMetadata,
  formatLeadCommercialTotals,
  legacyLeadLivesCount,
  quoteCommercialValues,
  resolveLeadCommercialValues,
  sumLeadCommercialValues,
} from "./commercial-values";

describe("lead commercial values", () => {
  it("records old and new monthly value and lives without lead details", () => {
    const previous = { monthlyValue: "500.5", livesCount: 2 };
    const next = { monthlyValue: "650.00", livesCount: 3 };
    const changes = {
      monthly_value: { from: "500.50", to: "650.00" },
      lives_count: { from: 2, to: 3 },
    };

    expect(commercialValuesAuditMetadata({ source: "manual", previous, next })).toEqual({
      source: "manual",
      changes,
    });
    expect(commercialValuesAuditMetadata({ source: "quote", previous, next })).toEqual({
      source: "quote",
      changes,
    });
  });

  it("fills the lead snapshot from the persisted quote summary", () => {
    expect(quoteCommercialValues({ totalMonthly: "1299.90", beneficiaryCount: 3 })).toEqual({
      monthlyValue: "1299.90",
      livesCount: 3,
    });
  });

  it("keeps missing or invalid quote totals nullable", () => {
    expect(quoteCommercialValues({ totalMonthly: null, beneficiaryCount: 0 })).toEqual({
      monthlyValue: null,
      livesCount: null,
    });
    expect(quoteCommercialValues({ totalMonthly: "300.00", beneficiaryCount: 101 })).toEqual({
      monthlyValue: "300.00",
      livesCount: null,
    });
  });

  it("reads a bounded legacy lives count without turning bad values into a guess", () => {
    expect(legacyLeadLivesCount({ qtdVidas: "3" })).toBe(3);
    expect(legacyLeadLivesCount({ numberOfLives: 2 })).toBe(2);
    expect(legacyLeadLivesCount({ qtdVidas: "muitas" })).toBeNull();
    expect(legacyLeadLivesCount({ qtdVidas: 101 })).toBeNull();
  });

  it("sums cents and lives for the currently displayed leads", () => {
    expect(sumLeadCommercialValues([
      { monthlyValue: "100.10", livesCount: 2 },
      { monthlyValue: "0.20", livesCount: 1 },
      { monthlyValue: null, livesCount: null },
    ])).toEqual({ monthlyValueCents: 10_030, livesCount: 3 });
  });

  it("keeps active sale and open proposal ahead of the editable lead snapshot", () => {
    expect(resolveLeadCommercialValues({
      lead: { monthlyValue: "500.00", livesCount: 2 },
      proposalMonthlyValue: "700.00",
      proposalLivesCount: 3,
      activeSaleMonthlyValue: "650.00",
    })).toEqual({ monthlyValue: "650.00", livesCount: 3, source: "sale" });
    expect(resolveLeadCommercialValues({
      lead: { monthlyValue: "500.00", livesCount: 2 },
      proposalMonthlyValue: "700.00",
      proposalLivesCount: 3,
    })).toEqual({ monthlyValue: "700.00", livesCount: 3, source: "proposal" });
    expect(resolveLeadCommercialValues({
      lead: { monthlyValue: "500.00", livesCount: 2 },
    })).toEqual({ monthlyValue: "500.00", livesCount: 2, source: "lead" });
  });

  it("formats Brazilian currency and the singular form", () => {
    expect(formatLeadCommercialTotals({ monthlyValueCents: 123_456, livesCount: 1 }))
      .toBe("R$ 1.234,56 · 1 vida");
  });
});
