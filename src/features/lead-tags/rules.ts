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

/** Teto do lote: a seleção da lista vai até a página inteira, com folga. */
export const LEAD_TAG_BULK_MAX = 500;

export type BulkLeadTagMode = "add" | "remove";

export type BulkLeadTagPlan = {
  /** Leads que mudam: ganham (add) ou perdem (remove) a etiqueta. */
  change: string[];
  /** No escopo, mas já estavam como pedido (já tinham ou já não tinham). */
  unchanged: string[];
  /** Fora do escopo de quem pede ou de outra empresa: ficam de fora. */
  skipped: number;
};

/**
 * Etiquetar em lote: só os leads que quem pede pode etiquetar (`canTagLead`) mudam. `leads` são os leads já lidos
 * da empresa do usuário; o que não voltou de lá (outra empresa ou inexistente) conta como fora do escopo.
 */
export function planBulkLeadTag(input: {
  context: { role: string; userId: string; branchId: string | null };
  requestedIds: readonly string[];
  leads: ReadonlyArray<{ id: string; corretorId: string | null; branchId: string | null }>;
  taggedLeadIds: readonly string[];
  mode: BulkLeadTagMode;
}): BulkLeadTagPlan {
  const requested = new Set(input.requestedIds);
  const tagged = new Set(input.taggedLeadIds);
  const allowed = input.leads.filter((lead) => requested.has(lead.id) && canTagLead(input.context, lead)).map((lead) => lead.id);
  const change = allowed.filter((id) => (input.mode === "add" ? !tagged.has(id) : tagged.has(id)));
  const changing = new Set(change);
  return { change, unchanged: allowed.filter((id) => !changing.has(id)), skipped: requested.size - allowed.length };
}

/** Texto do resultado do lote: o que mudou, o que já estava assim e o que ficou de fora. */
export function describeBulkLeadTag(input: { tagName: string; mode: BulkLeadTagMode; changed: number; unchanged: number; skipped: number }) {
  const parts: string[] = [];
  if (input.mode === "add") {
    parts.push(input.changed ? `"${input.tagName}" aplicada em ${leadsLabel(input.changed)}.` : `Nenhum lead novo com "${input.tagName}".`);
    if (input.unchanged) parts.push(`${leadsLabel(input.unchanged)} já ${input.unchanged === 1 ? "tinha" : "tinham"}.`);
  } else {
    parts.push(input.changed ? `"${input.tagName}" removida de ${leadsLabel(input.changed)}.` : `Nenhum lead tinha "${input.tagName}".`);
  }
  if (input.skipped) parts.push(`${leadsLabel(input.skipped)} fora do seu escopo ${input.skipped === 1 ? "ficou" : "ficaram"} de fora.`);
  return parts.join(" ");
}
