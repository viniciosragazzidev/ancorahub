import { stripAccents } from "@/features/tenant-intelligence/rag/search-terms";

export type MaterialValidity = {
  validFrom: Date | null;
  validUntil: Date | null;
  /** "explicit": dates found in the material. "default": the standard window. "none": no expiry. */
  source: "explicit" | "default" | "none";
};

/** Days a table stays valid when it states no end date. Operators resend tables each month. */
export const DEFAULT_MATERIAL_TTL_DAYS = 45;

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

/** Brazil has had a fixed UTC-3 offset since 2019. */
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function year(value: string) {
  const n = Number(value);
  return value.length <= 2 ? 2000 + n : n;
}

/** A real calendar date or null (rejects 31/02 and the like). */
function dayStart(day: number, month: number, y: number): Date | null {
  const date = new Date(Date.UTC(y, month - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return new Date(date.getTime() + SAO_PAULO_OFFSET_MS);
}

function dayEnd(day: number, month: number, y: number): Date | null {
  const start = dayStart(day, month, y);
  return start ? new Date(start.getTime() + DAY_MS - 1000) : null;
}

const DMY = String.raw`(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})`;

/**
 * Looks for the validity a price table states about itself: "vigência de
 * 01/10/2026 a 31/10/2026", "válida até 31/10/2026", "vigência outubro/2026".
 * It only trusts dates written next to those words. Returns nulls when none.
 */
export function detectMaterialValidity(text: string): { validFrom: Date | null; validUntil: Date | null } {
  const t = stripAccents(text.toLowerCase()).slice(0, 20_000);
  let validFrom: Date | null = null;
  let validUntil: Date | null = null;

  const range = new RegExp(String.raw`vigencia[^\n]{0,40}?${DMY}\s*(?:a|ate|ao|-)\s*${DMY}`).exec(t);
  if (range) {
    validFrom = dayStart(Number(range[1]), Number(range[2]), year(range[3]!));
    validUntil = dayEnd(Number(range[4]), Number(range[5]), year(range[6]!));
    if (validFrom && validUntil) return { validFrom, validUntil };
    validFrom = null;
    validUntil = null;
  }

  const until =
    new RegExp(String.raw`valid[oa]s?\s+ate\s+(?:o\s+dia\s+)?${DMY}`).exec(t) ??
    new RegExp(String.raw`validade\s*[:\-]?\s*(?:ate\s+)?${DMY}`).exec(t);
  if (until) validUntil = dayEnd(Number(until[1]), Number(until[2]), year(until[3]!));

  const fromDate = new RegExp(String.raw`(?:vigencia|vigente|a\s+partir\s+de)[^\n]{0,30}?${DMY}`).exec(t);
  if (fromDate) {
    validFrom = dayStart(Number(fromDate[1]), Number(fromDate[2]), year(fromDate[3]!));
  } else {
    const monthYear = new RegExp(String.raw`vigencia[^\n]{0,30}?(?:(\d{1,2})\s*/\s*(\d{4})|(${MONTH_NAMES})\s*(?:de|/)?\s*(\d{4}))`).exec(t);
    if (monthYear) {
      const month = monthYear[1] ? Number(monthYear[1]) : MONTHS[monthYear[3]!];
      const y = Number(monthYear[2] ?? monthYear[4]);
      if (month && month >= 1 && month <= 12) validFrom = dayStart(1, month, y);
    }
  }

  return { validFrom, validUntil };
}

/**
 * The window in which the material may answer a quote. A stated end date wins.
 * Without one the material expires `ttlDays` after it starts (its own start date
 * or `now`), so a stale table is never quoted. `ttlDays` of 0 disables expiry.
 */
export function resolveMaterialValidity(text: string, now: Date, ttlDays: number): MaterialValidity {
  const found = detectMaterialValidity(text);
  if (found.validUntil) return { validFrom: found.validFrom, validUntil: found.validUntil, source: "explicit" };
  if (ttlDays <= 0) return { validFrom: found.validFrom, validUntil: null, source: "none" };
  const start = found.validFrom ?? now;
  return { validFrom: found.validFrom, validUntil: new Date(start.getTime() + ttlDays * DAY_MS), source: "default" };
}

/** The configured window in days: a whole number of 0 or more, the default for anything else. */
export function parseMaterialTtlDays(value: string | null | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MATERIAL_TTL_DAYS;
}

export function isExpired(validity: Pick<MaterialValidity, "validUntil">, now: Date) {
  return validity.validUntil !== null && validity.validUntil.getTime() < now.getTime();
}
