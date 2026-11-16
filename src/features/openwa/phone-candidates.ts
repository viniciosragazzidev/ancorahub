import { sql, type AnyColumn } from "drizzle-orm";

/**
 * Egress 16/11: the OpenWA webhook used to load every lead, client and broker
 * phone of the tenant on each message. Its in-memory samePhone() only matches
 * values that share the last 8 digits with the sender, or that have fewer than
 * 8 digits (those can still match by suffix). So the database returns just
 * those candidates and samePhone() keeps deciding exactly as before. A sender
 * phone shorter than 8 digits keeps the full tenant scan.
 */
export function openWaPhoneCandidateFilter(column: AnyColumn, phone: string) {
  if (phone.length < 8) return undefined;
  const digits = sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;
  return sql`(right(${digits}, 8) = ${phone.slice(-8)} or length(${digits}) < 8)`;
}

/** The in-memory rule the webhook applies to each candidate (kept here so tests cover both). */
export function openWaSamePhone(value: string, phone: string) {
  const candidate = value.replace(/\D/g, "");
  return candidate === phone || candidate.endsWith(phone) || phone.endsWith(candidate) || candidate.slice(-11) === phone.slice(-11);
}
