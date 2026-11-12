import { describe, expect, it } from "vitest";

import type { CatalogPlan, Price } from "./contracts";
import { reviewIssues, summarizeReview } from "./review-check";

const date = "2026-11-12";
const price = (id: string, min: number, max: number | null, cents = 30000, extra: Partial<Price> = {}): Price => ({ id, cents, min, max, active: true, from: null, to: null, priority: 1, lives: null, ...extra });
const bands = [price("a", 0, 18), price("b", 19, 23), price("c", 24, 28), price("d", 29, 33), price("e", 34, 38), price("f", 39, 43), price("g", 44, 48), price("h", 49, 53), price("i", 54, 58), price("j", 59, null)];

function plan(overrides: Partial<CatalogPlan> = {}): CatalogPlan {
  return {
    id: "p1", name: "Plano", code: "P1", operator: "Op", operatorId: "op", administrator: "", modality: "PESSOA_FISICA",
    accommodation: "", coparticipation: "", coverage: "", entity: "", cities: ["Niterói"], businessProfiles: [], dental: null,
    minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null, dependentMax: null, minLives: null, maxLives: null,
    minHolders: null, ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: true, from: null, to: null,
    prices: bands, networkCount: 0, detailCount: 0, ...overrides,
  };
}

describe("conferência automática do plano", () => {
  it("plano completo passa", () => {
    expect(reviewIssues(plan(), date)).toEqual([]);
  });
  it("aponta faixa sem preço, preço duplicado, vigência e falta de município", () => {
    expect(reviewIssues(plan({ prices: bands.filter((item) => item.id !== "j") }), date)).toContain("age_band_without_price");
    expect(reviewIssues(plan({ prices: [...bands, price("dup", 34, 38, 31000)] }), date)).toContain("ambiguous_price");
    expect(reviewIssues(plan({ to: "2026-10-31" }), date)).toContain("out_of_validity");
    expect(reviewIssues(plan({ prices: bands.map((item) => ({ ...item, active: false })) }), date)).toContain("no_active_price");
    expect(reviewIssues(plan({ cities: [] }), date)).toContain("no_city");
  });
  it("critério sem confirmação na fonte não passa; perfil de empresa só conta em PME", () => {
    expect(reviewIssues(plan({ eligibilityConfirmed: false }), date)).toContain("criteria_unconfirmed");
    expect(reviewIssues(plan({ businessConfirmed: false }), date)).toEqual([]);
    expect(reviewIssues(plan({ modality: "PME_EMPRESARIAL", businessConfirmed: false }), date)).toContain("business_unconfirmed");
  });
  it("faixa fora do limite de idade do plano não é exigida", () => {
    expect(reviewIssues(plan({ maxAge: 58, prices: bands.filter((item) => item.id !== "j") }), date)).toEqual([]);
  });
  it("resume por motivo", () => {
    expect(summarizeReview([{ issues: [], reviewed: true }, { issues: ["no_city"], reviewed: false }])).toEqual({ total: 2, passed: 1, reviewed: 1, issues: { no_city: 1 } });
  });
});
