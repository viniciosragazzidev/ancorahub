export type MetaCaptureMode = "all" | "selective" | "disabled";

export type MetaCampaignCaptureRule = {
  campaignId: string;
  enabled: boolean;
};

/** Mirrors the tenant's current campaign-capture policy on the server. */
export function resolveMetaCampaignEligibility(input: {
  storedMode: string | null | undefined;
  hasTenantRules: boolean;
  campaignRules: MetaCampaignCaptureRule[];
}): { mode: MetaCaptureMode; campaignIds: string[] } {
  const mode: MetaCaptureMode = input.storedMode === "all" || input.storedMode === "selective" || input.storedMode === "disabled"
    ? input.storedMode
    : input.hasTenantRules
      ? "selective"
      : "all";

  return {
    mode,
    campaignIds: input.campaignRules.filter((rule) => rule.enabled).map((rule) => rule.campaignId),
  };
}
