type OfferHistoryRow = {
  id: string;
  brokerId: string;
  brokerName: string | null;
  status: string;
  offeredAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
};

type LeadEngagementState = {
  corretorId: string | null;
  status: string;
  firstContactAt: Date | null;
  serviceStartedAt: Date | null;
};

export type OfferOutcomeHistoryItem = {
  id: string;
  createdAt: string;
  action: "accepted" | "declined" | "not_accepted";
  source: "offer";
  strategy: "whatsapp_offer";
  reason: string;
  previousOwnerName: null;
  newOwnerName: string | null;
  fromBranchName: null;
  toBranchName: null;
  actorName: null;
  brokerId: string;
};

const ACTIVE_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);
const ENGAGED_LEAD_STATUSES = new Set([
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
]);

/**
 * Projects persisted offer outcomes into the attribution timeline. A pending
 * offer is considered accepted only when the same provisional owner has already
 * moved the lead into active service after the offer was created.
 */
export function buildOfferOutcomeHistory(
  offers: readonly OfferHistoryRow[],
  lead: LeadEngagementState,
): OfferOutcomeHistoryItem[] {
  const activeCurrentOffer = offers
    .filter((offer) => offer.brokerId === lead.corretorId && ACTIVE_STATUSES.has(offer.status))
    .sort((a, b) => b.offeredAt.getTime() - a.offeredAt.getTime())[0];
  const engagementAt = lead.serviceStartedAt ?? lead.firstContactAt;
  const implicitAcceptance = activeCurrentOffer
    && ENGAGED_LEAD_STATUSES.has(lead.status)
    && engagementAt
    && engagementAt.getTime() >= activeCurrentOffer.offeredAt.getTime()
    ? activeCurrentOffer.id
    : null;

  return offers.flatMap((offer) => {
    const outcome = offer.status === "ACCEPTED" && offer.acceptedAt
      ? { action: "accepted" as const, at: offer.acceptedAt, reason: "O corretor aceitou o atendimento." }
      : offer.status === "DECLINED" && offer.declinedAt
        ? { action: "declined" as const, at: offer.declinedAt, reason: "O corretor recusou o atendimento." }
        : offer.status === "EXPIRED"
          ? { action: "not_accepted" as const, at: offer.expiresAt, reason: "O prazo terminou sem aceite do corretor." }
          : offer.id === implicitAcceptance && engagementAt
            ? { action: "accepted" as const, at: engagementAt, reason: "O corretor iniciou o atendimento." }
            : null;

    if (!outcome) return [];
    return [{
      id: `offer-outcome:${offer.id}:${outcome.action}`,
      createdAt: outcome.at.toISOString(),
      action: outcome.action,
      source: "offer" as const,
      strategy: "whatsapp_offer" as const,
      reason: outcome.reason,
      previousOwnerName: null,
      newOwnerName: offer.brokerName,
      fromBranchName: null,
      toBranchName: null,
      actorName: null,
      brokerId: offer.brokerId,
    }];
  });
}
