import { describe, expect, it } from "vitest";

import { canRemoveFromDistribution, distributionRemovalTag, isDistributionRemovalReason } from "./distribution-removal";

describe("removing a lead from distribution", () => {
  it("accepts only the two reasons", () => {
    expect(isDistributionRemovalReason("disqualified_no_value")).toBe(true);
    expect(isDistributionRemovalReason("external_broker_transfer")).toBe(true);
    expect(isDistributionRemovalReason("lost")).toBe(false);
    expect(isDistributionRemovalReason(null)).toBe(false);
  });

  it("tags the lead with the reason", () => {
    expect(distributionRemovalTag("disqualified_no_value")).toBe("Fora da distribuição · Desqualificado sem valor");
    expect(distributionRemovalTag("external_broker_transfer")).toBe("Fora da distribuição · Corretor externo");
    expect(distributionRemovalTag(null)).toBeNull();
  });

  it("is available only for an open lead without a broker, not yet removed", () => {
    const open = { corretorId: null, distributionRemovedAt: null };
    expect(canRemoveFromDistribution(open)).toBe(true);
    expect(canRemoveFromDistribution({ ...open, corretorId: "broker" })).toBe(false);
    expect(canRemoveFromDistribution({ ...open, distributionRemovedAt: new Date() })).toBe(false);
    expect(canRemoveFromDistribution({ ...open, archivedAt: new Date() })).toBe(false);
  });
});
