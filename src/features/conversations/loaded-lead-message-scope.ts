import { and, inArray, isNull, or, sql } from "drizzle-orm";

import { normalizePhone } from "@/shared/utils/phone";
import { schema } from "@/shared/db";

/**
 * Restrict conversation-message reads to the leads already visible in the page.
 * Messages without a lead_id can still be attached by phone, matching the same
 * normalized suffix logic used by the conversation assembler.
 */
export function loadedLeadMessageScope(input: {
  message: typeof schema.whatsappMessages;
  leads: Array<{ id: string; phone: string | null }>;
}) {
  const leadIds = [...new Set(input.leads.map((lead) => lead.id))];
  const phones = [...new Set(input.leads.map((lead) => normalizePhone(lead.phone)).filter(Boolean))];
  const suffixes = [...new Set(phones.filter((phone) => phone.length >= 8).map((phone) => phone.slice(-8)))];
  const phoneMatches = or(
    suffixes.length
      ? inArray(sql`right(regexp_replace(coalesce(${input.message.phone}, ''), '[^0-9]', '', 'g'), 8)`, suffixes)
      : undefined,
    phones.length
      ? inArray(sql`regexp_replace(coalesce(${input.message.phone}, ''), '[^0-9]', '', 'g')`, phones)
      : undefined,
  );

  return or(
    leadIds.length ? inArray(input.message.leadId, leadIds) : undefined,
    phoneMatches ? and(isNull(input.message.leadId), phoneMatches) : undefined,
  ) ?? sql`false`;
}
