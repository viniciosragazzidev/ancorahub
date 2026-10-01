export const LEAD_QUALITY_DIMENSIONS = [
  "source",
  "campaign",
  "adset",
  "ad",
  "form",
  "queue",
  "broker",
  "lead_type",
  "plan_type",
  "city",
  "age_band",
  "hour",
] as const;

export type LeadQualityDimension = (typeof LEAD_QUALITY_DIMENSIONS)[number];
export type LeadQualityFocus = { dimension: LeadQualityDimension; key: string };

/** Validate URL-controlled drill-downs before they reach any data query. */
export function parseLeadQualityFocus(rawDimension: unknown, rawKey: unknown): LeadQualityFocus | null {
  if (typeof rawDimension !== "string" || typeof rawKey !== "string") return null;
  if (!(LEAD_QUALITY_DIMENSIONS as readonly string[]).includes(rawDimension)) return null;
  const key = rawKey.trim();
  if (!key || key.length > 160) return null;
  if (rawDimension === "hour" && !/^[0-6]:(?:[0-9]|1[0-9]|2[0-3])$/.test(key)) return null;
  return { dimension: rawDimension as LeadQualityDimension, key };
}
