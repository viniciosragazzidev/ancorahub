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
  /** Formulário / WhatsApp / Outros (see LEAD_ORIGINS). */
  "origin",
  /** Turno 1 (18h–13h30) / Turno 2 (13h30–18h). */
  "shift",
  /** Origin × shift, key "whatsapp:2". */
  "origin_shift",
] as const;

export const LEAD_ORIGINS = [
  { key: "form", label: "Formulário" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "other", label: "Outros" },
] as const;
export type LeadOrigin = (typeof LEAD_ORIGINS)[number]["key"];

export function parseLeadOrigin(raw: unknown): LeadOrigin | null {
  return raw === "form" || raw === "whatsapp" || raw === "other" ? raw : null;
}

/** Report filters chosen on the page / export: one queue or all, one origin or all. */
export type LeadQualityFilters = { queueId: string | null; origin: LeadOrigin | null };

export type LeadQualityDimension = (typeof LEAD_QUALITY_DIMENSIONS)[number];
export type LeadQualityFocus = { dimension: LeadQualityDimension; key: string };

/** Validate URL-controlled drill-downs before they reach any data query. */
export function parseLeadQualityFocus(rawDimension: unknown, rawKey: unknown): LeadQualityFocus | null {
  if (typeof rawDimension !== "string" || typeof rawKey !== "string") return null;
  if (!(LEAD_QUALITY_DIMENSIONS as readonly string[]).includes(rawDimension)) return null;
  const key = rawKey.trim();
  if (!key || key.length > 160) return null;
  if (rawDimension === "hour" && !/^[0-6]:(?:[0-9]|1[0-9]|2[0-3])$/.test(key)) return null;
  if (rawDimension === "origin" && !parseLeadOrigin(key)) return null;
  if (rawDimension === "shift" && key !== "1" && key !== "2") return null;
  if (rawDimension === "origin_shift" && !/^(form|whatsapp|other):[12]$/.test(key)) return null;
  return { dimension: rawDimension as LeadQualityDimension, key };
}
