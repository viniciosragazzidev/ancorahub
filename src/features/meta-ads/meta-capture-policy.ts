import "server-only";

export type MetaCaptureMode = "all" | "selective" | "disabled";

export type MetaCaptureRoute = {
  enabled: boolean;
  queueId: string | null;
  queueStatus: string | null;
};

/**
 * Single server-side policy for Meta Lead Ads intake and UI projections.
 * Asset rules are intentionally more specific than campaign rules; a disabled
 * child only blocks an asset in global mode and does not discard a campaign
 * explicitly authorized in selective mode.
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

  const mostSpecificRoute = input.adRoute ?? input.formRoute ?? input.campaignRoute;

  if (mode === "all") {
    if (mostSpecificRoute && !mostSpecificRoute.enabled) {
      return { action: "ignore" as const, queueId: null };
    }
    if (mostSpecificRoute?.queueId && mostSpecificRoute.queueStatus === "active") {
      return { action: "capture" as const, queueId: mostSpecificRoute.queueId };
    }
    return { action: "capture" as const, queueId: null };
  }

  if (input.campaignRoute?.enabled) {
    const enabledChild = input.adRoute?.enabled
      ? input.adRoute
      : input.formRoute?.enabled
        ? input.formRoute
        : input.campaignRoute;
    if (enabledChild.queueId && enabledChild.queueStatus === "active") {
      return { action: "capture" as const, queueId: enabledChild.queueId };
    }
    if (input.campaignRoute.queueId && input.campaignRoute.queueStatus === "active") {
      return { action: "capture" as const, queueId: input.campaignRoute.queueId };
    }
    return { action: "capture" as const, queueId: null };
  }

  if (!mostSpecificRoute || !mostSpecificRoute.enabled) {
    return { action: "ignore" as const, queueId: null };
  }
  if (mostSpecificRoute.queueId && mostSpecificRoute.queueStatus === "active") {
    return { action: "capture" as const, queueId: mostSpecificRoute.queueId };
  }
  return { action: "capture" as const, queueId: null };
}
