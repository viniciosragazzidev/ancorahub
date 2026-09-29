import { evaluateBrokerOfferPacing, type OfferPacingConfig, type PacingOffer } from "./offer-pacing";

/**
 * Live, per-broker "can they receive the next automatic lead right now"
 * status for the plantão profile page. Pure and testable — the page just
 * feeds it offers/capacity and gets back a status plus the one timestamp
 * (`nextEventAt`) the client needs to run its own countdown.
 */
export type BrokerLiveOfferStatus = "paused" | "blocked" | "capacity_full" | "offer_pending" | "cooldown" | "ready";

export type BrokerLiveOfferState = {
  status: BrokerLiveOfferStatus;
  /** When this status is expected to change on its own (offer expiry or pacing release). Null when there's nothing to count down to. */
  nextEventAt: Date | null;
};

export function classifyBrokerLiveOfferStatus(input: {
  /** A director/manager deliberately paused this escalado — outranks every other state, including a technical block. */
  paused: boolean;
  blockedReason: string | null;
  capacity: number | null;
  activeLeads: number;
  pacing: OfferPacingConfig;
  offers: PacingOffer[];
  now: Date;
}): BrokerLiveOfferState {
  if (input.paused) return { status: "paused", nextEventAt: null };
  if (input.blockedReason) return { status: "blocked", nextEventAt: null };
  if (input.capacity !== null && input.activeLeads >= input.capacity) return { status: "capacity_full", nextEventAt: null };

  const ACTIVE_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);
  const activeOffer = input.offers.find((offer) => ACTIVE_STATUSES.has(offer.status) && offer.expiresAt > input.now);
  if (activeOffer) return { status: "offer_pending", nextEventAt: activeOffer.expiresAt };

  const pacingDecision = evaluateBrokerOfferPacing(input.offers, input.pacing, input.now);
  if (!pacingDecision.allowed) return { status: "cooldown", nextEventAt: pacingDecision.retryAt };

  return { status: "ready", nextEventAt: null };
}
