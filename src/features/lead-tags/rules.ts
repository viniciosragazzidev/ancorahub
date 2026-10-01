/**
 * Lead tags (labels on lead conversations, like WhatsApp Business labels).
 * Pure rules: who keeps the list, who tags a lead, and what a valid tag is.
 */

export type LeadTag = { id: string; name: string; colorHue: number };

export const LEAD_TAG_NAME_MAX = 32;

/** "  retornar   amanhã " → "retornar amanhã"; empty when nothing is left. */
export function normalizeLeadTagName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, LEAD_TAG_NAME_MAX);
}

/** Directors and managers keep the tenant's tag list (names and colors). */
export function canManageLeadTags(role: string) {
  return role === "director" || role === "manager";
}

/** Who may tag a lead: the director any lead, a manager the leads of their unit, a broker their own leads. */
export function canTagLead(
  context: { role: string; userId: string; branchId: string | null },
  lead: { corretorId: string | null; branchId: string | null },
) {
  if (context.role === "director") return true;
  if (context.role === "manager") return Boolean(context.branchId) && lead.branchId === context.branchId;
  return lead.corretorId === context.userId;
}
