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

/** A tag with how many leads carry it (settings table). */
export type LeadTagWithUsage = LeadTag & { leadCount: number };

export type LeadTagMergePlan = {
  /** Leads that only had the source: their assignment moves to the target. */
  move: string[];
  /** Leads that already had both: the source assignment is just dropped (no duplicate pair). */
  alreadyTagged: string[];
  /** Every lead that loses the source tag ("sai de N leads"). */
  leaving: number;
};

/** Merging `source` into `target`: which assignments move and which are dropped, with no lead+tag pair twice. */
export function planLeadTagMerge(input: { sourceLeadIds: readonly string[]; targetLeadIds: readonly string[] }): LeadTagMergePlan {
  const target = new Set(input.targetLeadIds);
  const source = [...new Set(input.sourceLeadIds)];
  const move = source.filter((leadId) => !target.has(leadId));
  const alreadyTagged = source.filter((leadId) => target.has(leadId));
  return { move, alreadyTagged, leaving: source.length };
}

const leadsLabel = (count: number) => `${count} ${count === 1 ? "lead" : "leads"}`;

/** Confirmation text: the exact impact before merging. */
export function describeLeadTagMerge(input: { sourceName: string; targetName: string; leaving: number }) {
  if (input.leaving === 0) return `"${input.sourceName}" não está em nenhum lead. Ela será excluída e "${input.targetName}" continua como está.`;
  return `"${input.sourceName}" sai de ${leadsLabel(input.leaving)} e é excluída. Esses leads passam a ter "${input.targetName}". Quem já tinha as duas fica com uma só.`;
}

/** Confirmation text for deleting a tag. */
export function describeLeadTagDelete(input: { name: string; leadCount: number }) {
  if (input.leadCount === 0) return `"${input.name}" não está em nenhum lead.`;
  return `"${input.name}" sai de ${leadsLabel(input.leadCount)}. Não dá para desfazer.`;
}
