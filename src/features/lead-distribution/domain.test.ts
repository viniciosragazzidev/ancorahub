import { describe, expect, it } from "vitest";
import { calculateBrokerRankingScore, chooseBroker, defaultIntelligentDistributionPolicy, getDutyCoverage, isValidDutyWindow, rankBrokers } from "./domain";

describe("lead distribution domain", () => {
  it("chooses the lowest active workload when capacity is available", () => {
    const result = chooseBroker([
      { id: "a", createdAt: new Date("2026-01-01"), activeLeads: 4, capacity: 5 },
      { id: "b", createdAt: new Date("2026-01-02"), activeLeads: 1, capacity: 5 },
    ], "capacity");
    expect(result?.id).toBe("b");
  });

  it("does not choose a broker at capacity", () => {
    const result = chooseBroker([{ id: "a", createdAt: new Date(), activeLeads: 5, capacity: 5 }], "capacity");
    expect(result).toBeNull();
  });

  it("uses the oldest eligible broker for the current round-robin policy", () => {
    const result = chooseBroker([
      { id: "newer", createdAt: new Date("2026-02-01"), activeLeads: 0, capacity: null },
      { id: "older", createdAt: new Date("2026-01-01"), activeLeads: 9, capacity: null },
    ], "round_robin");

    expect(result?.id).toBe("older");
  });

  it("validates duty windows deterministically", () => {
    expect(isValidDutyWindow(1, "09:00", "18:00")).toBe(true);
    expect(isValidDutyWindow(1, "18:00", "09:00")).toBe(false);
    expect(isValidDutyWindow(8, "09:00", "18:00")).toBe(false);
  });

  it("reports a real coverage gap without changing eligibility", () => {
    expect(getDutyCoverage(1, 2)).toEqual({ assigned: 1, minimum: 2, missing: 1, covered: false });
    expect(getDutyCoverage(3, 2)).toEqual({ assigned: 3, minimum: 2, missing: 0, covered: true });
  });

  it("always ranks active duty before performance, then uses a deterministic fallback", () => {
    const ranked = rankBrokers([
      { id: "high", createdAt: new Date("2026-01-01"), activeLeads: 1, capacity: null, onDuty: false, conversionRate: 1, slaRate: 1, manualPriority: 1, idleSince: new Date("2026-01-01"), rankingScore: 100 },
      { id: "duty", createdAt: new Date("2026-01-02"), activeLeads: 3, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0 },
    ], defaultIntelligentDistributionPolicy);
    expect(ranked.map((broker) => broker.id)).toEqual(["duty", "high"]);
  });

  it("calculates an explainable weighted broker score", () => {
    expect(calculateBrokerRankingScore({ conversionRate: 1, slaRate: 1, manualPriority: 0 }, defaultIntelligentDistributionPolicy)).toBe(80);
  });
});
