export type LeadOfferAcceptResponse = { processed: boolean; won?: boolean; reason?: string };

export type LeadAcceptOwnership = { corretorId: string | null; assignmentSource: string | null } | null;

export type LeadAcceptOutcome = { ok: true } | { ok: false; error: string };

const PROVISIONAL_SOURCES = new Set(["automatic_offer", "manual_offer"]);

/**
 * Interprets a CRM "Aceitar lead" click. The broker only proceeds when the lead
 * is confirmed as theirs afterwards: a won offer, an offer they had already
 * accepted, or a lead they already own outside a pending offer. A provisional
 * ownership without an acceptable offer is still subject to rotation, so it is
 * reported as expired instead of letting the broker work a lead about to move.
 */
export function resolveLeadAcceptOutcome(
  response: LeadOfferAcceptResponse,
  lead: LeadAcceptOwnership,
  brokerId: string,
): LeadAcceptOutcome {
  if (response.won || response.reason === "already_accepted") return { ok: true };

  const ownsLead = lead?.corretorId === brokerId;
  if (ownsLead && !PROVISIONAL_SOURCES.has(lead?.assignmentSource ?? "")) return { ok: true };

  if (response.reason === "expired" || ownsLead) {
    return { ok: false, error: "O prazo para aceitar este lead terminou." };
  }
  if (response.reason === "already_assigned" || (lead?.corretorId && lead.corretorId !== brokerId)) {
    return { ok: false, error: "Este lead já foi assumido por outro corretor." };
  }
  return { ok: false, error: "Este lead não está mais disponível para você." };
}
