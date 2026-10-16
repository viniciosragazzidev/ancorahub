import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";

const ORIGIN_KEYS_TO_NULL = [
  "sourceChannel",
  "sourceCampaign",
  "sourceAd",
  "sourceForm",
  "metaCampaignId",
  "metaAdId",
  "metaFormId",
  "capturedAt",
] as const;

/**
 * Brokers must not learn where a lead came from or when it reached the
 * brokerage. The screens already hide it; this also keeps it out of the data
 * sent to the broker's browser.
 *
 * The assignment time stays (the first-contact countdown needs it) and stands
 * in for the creation date, so ordering and the SLA keep working.
 */
export function stripLeadOriginForBroker<T extends object>(lead: T): T {
  const next: Record<string, unknown> = { ...(lead as Record<string, unknown>) };

  if ("origem" in next) next.origem = "";
  if ("source" in next) next.source = "";
  for (const key of ORIGIN_KEYS_TO_NULL) {
    if (key in next) next[key] = null;
  }
  if ("sourceMetadata" in next) next.sourceMetadata = readMetaLeadDisplayDetails(null, null);
  if ("createdAt" in next && next.assignedAt) next.createdAt = next.assignedAt;

  return next as T;
}

/** Applies {@link stripLeadOriginForBroker} to a list, only when the viewer is a broker. */
export function stripLeadOriginForRole<T extends object>(role: string | null | undefined, leads: T[]): T[] {
  return role === "broker" ? leads.map(stripLeadOriginForBroker) : leads;
}
