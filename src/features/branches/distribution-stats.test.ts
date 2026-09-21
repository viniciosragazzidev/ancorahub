import { describe, expect, it } from "vitest";

import { ACTIVE_LEAD_STATUSES, aggregateBranchDistributionStats } from "./distribution-stats";

describe("aggregateBranchDistributionStats", () => {
  it("counts only available brokers, per branch", () => {
    const stats = aggregateBranchDistributionStats(
      [
        { branchId: "a", availabilityStatus: "available", count: 3 },
        { branchId: "a", availabilityStatus: "paused", count: 5 },
        { branchId: "b", availabilityStatus: "available", count: "2" },
        { branchId: null, availabilityStatus: "available", count: 9 },
      ],
      [],
    );
    expect(stats.get("a")?.availableBrokers).toBe(3);
    expect(stats.get("b")?.availableBrokers).toBe(2);
    expect(stats.has("null")).toBe(false);
  });

  it("separates active leads from new leads and ignores closed ones", () => {
    const stats = aggregateBranchDistributionStats(
      [],
      [
        { branchId: "a", status: "new", count: 4 },
        { branchId: "a", status: "in_contact", count: 6 },
        { branchId: "a", status: "lost", count: 50 },
        { branchId: "a", status: "won", count: 20 },
      ],
    );
    // "new" é ativo E novo; "lost"/"won" não entram na carteira ativa.
    expect(stats.get("a")).toEqual({ availableBrokers: 0, activeLeads: 10, newLeads: 4 });
  });

  it("returns nothing for branches without rows and skips rows without a branch", () => {
    const stats = aggregateBranchDistributionStats([], [{ branchId: null, status: "new", count: 1 }]);
    expect(stats.size).toBe(0);
  });

  it("keeps the active status list used by the distribution screen", () => {
    expect(ACTIVE_LEAD_STATUSES).toEqual([
      "new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis",
    ]);
  });
});
