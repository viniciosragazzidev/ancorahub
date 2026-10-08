import "server-only";

export type MetaCaptureMode = "all" | "selective" | "disabled";

export type MetaCaptureRoute = {
  enabled: boolean;
  queueId: string | null;
  queueStatus: string | null;
};

/**
 * Single server-side policy for Meta Lead Ads intake and UI projections.
 * Campaigns are the single authority for capture and destination. Child assets
 * inherit the campaign decision and never override it.
 */
export function resolveMetaCapturePolicy(input: {
  adRoute?: MetaCaptureRoute;
  campaignRoute?: MetaCaptureRoute;
  formRoute?: MetaCaptureRoute;
  globalMode?: MetaCaptureMode;
  hasTenantRules?: boolean;
  /** Backward-compatible name used by older callers. */
  hasTenantCampaignRules?: boolean;
}) {
  const mode = input.globalMode ?? ((input.hasTenantRules ?? input.hasTenantCampaignRules) ? "selective" : "all");

  if (mode === "disabled") {
    return { action: "ignore" as const, queueId: null };
  }

  // An enabled campaign is the only per-asset grant. Ads and forms inherit
  // this queue so a shared form cannot redirect leads from another campaign.
  if (input.campaignRoute?.enabled) {
    if (input.campaignRoute.queueId && input.campaignRoute.queueStatus === "active") {
      return { action: "capture" as const, queueId: input.campaignRoute.queueId };
    }
    // A campaign without an active destination must never fall through to
    // direct intake or create an unqueued lead.
    return { action: "ignore" as const, queueId: null };
  }

  if (input.campaignRoute && !input.campaignRoute.enabled) {
    return { action: "ignore" as const, queueId: null };
  }

  // Global mode is a safety gate only. Each campaign must be enabled with
  // its own active queue; ads and forms inherit that campaign rule.
  return { action: "ignore" as const, queueId: null };
}
