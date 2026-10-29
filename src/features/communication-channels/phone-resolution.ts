import "server-only";

import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { normalizeWhatsAppDestination } from "@/lib/whatsapp-url";
import { phoneSubscriberSuffix } from "@/features/waha-cadence/phone-matching";

/**
 * Resolve a delivery number without changing the phone stored on the lead.
 * When a provider message already contains the same subscriber, its full
 * international number is preferred so a stale DDD cannot break delivery.
 * Ambiguous matches deliberately fall back to the stored value.
 */
const HISTORY_WITHOUT_LEAD_DAYS = 30;

export async function resolveCanonicalWhatsAppDestination(input: {
  tenantId: string;
  phone: string;
  leadId?: string | null;
}) {
  const fallback = normalizeWhatsAppDestination(input.phone);
  const suffix = phoneSubscriberSuffix(input.phone);
  if (!fallback || !suffix) return fallback;

  try {
    const rows = await getDatabase()
      .select({ phone: schema.whatsappMessages.phone, direction: schema.whatsappMessages.direction })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.tenantId, input.tenantId),
          isNotNull(schema.whatsappMessages.phone),
          sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 9) = ${suffix}`,
          // Without the lead, only recent history: a number with no match used to scan every message of the tenant.
          input.leadId ? eq(schema.whatsappMessages.leadId, input.leadId) : gte(schema.whatsappMessages.sentAt, new Date(Date.now() - HISTORY_WITHOUT_LEAD_DAYS * 86_400_000)),
        ),
      )
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(50);

    const inbound = rows.filter((row) => row.direction === "incoming" || row.direction === "inbound");
    const candidates = (inbound.length ? inbound : rows)
      .map((row) => normalizeWhatsAppDestination(row.phone))
      .filter((value): value is string => Boolean(value));
    const unique = [...new Set(candidates)];
    return unique.length === 1 ? unique[0] : fallback;
  } catch {
    return fallback;
  }
}
