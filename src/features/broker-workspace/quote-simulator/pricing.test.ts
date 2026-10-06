import { describe, expect, it } from "vitest";
import { AGE_BANDS, MOCK_PLANS, type ProfileType } from "./mock-data";
import { calculatePlanPricing, getAgeBand, isAnsAgeTableCompliant } from "./pricing";

const preferences = {
  profileType: "individual" as ProfileType,
  region: "rj-capital" as const,
  accommodation: "ward" as const,
  copayment: "partial" as const,
  coverage: "regional" as const,
  includeDental: false,
};

describe("getAgeBand", () => {
  it.each([
    [0, "0-18"],
    [18, "0-18"],
    [19, "19-23"],
    [23, "19-23"],
    [24, "24-28"],
    [29, "29-33"],
    [34, "34-38"],
    [39, "39-43"],
    [44, "44-48"],
    [49, "49-53"],
    [54, "54-58"],
    [59, "59+"],
    [120, "59+"],
  ])("maps age %i to band %s", (age, expected) => {
    expect(getAgeBand(age).id).toBe(expected);
  });

  it.each([-1, 121, 1.5, Number.NaN])("rejects invalid age %s", (age) => {
    expect(() => getAgeBand(age)).toThrow(RangeError);
  });
});

describe("ANS age-band mock tables", () => {
  it("has the 10 official bands", () => {
    expect(AGE_BANDS).toHaveLength(10);
    expect(AGE_BANDS[0].label).toBe("0 a 18 anos");
    expect(AGE_BANDS[9].label).toBe("59 anos ou mais");
  });

  it.each(MOCK_PLANS.map((plan) => [plan.id, plan] as const))("%s obeys the RN 563/2022 limits", (_id, plan) => {
    expect(isAnsAgeTableCompliant(plan)).toBe(true);
  });

  it("rejects a final band above six times the first", () => {
    const plan = { ...MOCK_PLANS[0], ageBandMultipliers: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2, 3, 6.01] };
    expect(isAnsAgeTableCompliant(plan)).toBe(false);
  });

  it("rejects a seventh-to-tenth increase larger than first-to-seventh", () => {
    const plan = { ...MOCK_PLANS[0], ageBandMultipliers: [1, 1.2, 1.4, 1.6, 1.8, 2, 2.1, 2.8, 3.2, 3.6] };
    expect(isAnsAgeTableCompliant(plan)).toBe(false);
  });
});

describe("calculatePlanPricing", () => {
  it("prices each beneficiary by age band and returns a total and per-life average", () => {
    const plan = MOCK_PLANS[0];
    const result = calculatePlanPricing(plan, preferences, [
      { id: "titular", age: 18 },
      { id: "dependente", age: 59 },
    ]);
    expect(result.beneficiaries.map((person) => person.ageBandLabel)).toEqual(["0 a 18 anos", "59 anos ou mais"]);
    expect(result.monthlyTotal).toBe(result.beneficiaries.reduce((sum, person) => sum + person.monthlyPrice, 0));
    expect(result.monthlyPerLife).toBe(Math.round((result.monthlyTotal / 2) * 100) / 100);
  });

  it("applies region, room, copay, coverage, group and dental multipliers", () => {
    const plan = MOCK_PLANS[1];
    const person = [{ id: "titular", age: 30 }];
    const standard = calculatePlanPricing(plan, preferences, person).monthlyTotal;
    const richer = calculatePlanPricing(plan, {
      ...preferences,
      profileType: "pme",
      region: "sp-capital",
      accommodation: "private",
      copayment: "none",
      coverage: "national",
      includeDental: true,
    }, person).monthlyTotal;
    expect(richer).toBeGreaterThan(standard);
  });

  it("returns zero for an empty beneficiary list", () => {
    expect(calculatePlanPricing(MOCK_PLANS[0], preferences, [])).toEqual({
      beneficiaries: [],
      monthlyTotal: 0,
      monthlyPerLife: 0,
    });
  });

  it("rejects options unavailable in a plan", () => {
    expect(() => calculatePlanPricing(MOCK_PLANS[12], {
      ...preferences,
      accommodation: "private",
    }, [{ id: "titular", age: 32 }])).toThrow(/acomodação/);
  });
});
