import { describe, expect, it } from "vitest";
import { resolveMetaCampaignEligibility } from "./meta-campaign-eligibility";

describe("resolveMetaCampaignEligibility", () => {
  it("uses all Meta campaigns when no tenant rule exists", () => {
    expect(resolveMetaCampaignEligibility({ storedMode: null, hasTenantRules: false, campaignRules: [] }))
      .toEqual({ mode: "all", campaignIds: [] });
  });

  it("returns only enabled tenant-owned campaigns in selective mode", () => {
    expect(resolveMetaCampaignEligibility({
      storedMode: "selective",
      hasTenantRules: true,
      campaignRules: [{ campaignId: "campaign-eligible", enabled: true }, { campaignId: "campaign-disabled", enabled: false }],
    })).toEqual({ mode: "selective", campaignIds: ["campaign-eligible"] });
  });

  it("keeps capture disabled even when historical rules exist", () => {
    expect(resolveMetaCampaignEligibility({
      storedMode: "disabled",
      hasTenantRules: true,
      campaignRules: [{ campaignId: "campaign-eligible", enabled: true }],
    })).toEqual({ mode: "disabled", campaignIds: ["campaign-eligible"] });
  });
});
