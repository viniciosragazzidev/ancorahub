/**
 * Offer pacing: protects a broker from a flood of simultaneous offers (for
 * example when a backlog is released at the start of a duty window).
 *
 * Max pending: at most M offers awaiting a response at the same time, per queue (0 disables it).
 * The interval between offers was retired (DEC-151, 26/10/2026): a qualified lead goes to the
 * next broker at once. The queue column stays for history but is no longer read.
 */
export const DEFAULT_OFFER_INTERVAL_MINUTES = 0;
export const DEFAULT_MAX_PENDING_OFFERS = 1;

const PENDING_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);
/**
 * A pending offer can be answered at any moment (accepted in the CRM, on
 * WhatsApp, by starting service…), and none of those paths re-wakes the
 * leads that were waiting on it. So a pending slot is re-checked at this
 * cadence rather than parked until the offer's expiry, which with a long
 * acceptance SLA kept leads queued for up to an hour next to free brokers.
 */
export const PENDING_OFFER_RECHECK_MS = 60_000;

export type OfferPacingConfig = { intervalMinutes: number; maxPending: number };
export type PacingOffer = { status: string; offeredAt: Date; expiresAt: Date };
export type OfferPacingDecision =
  | { allowed: true; retryAt: null; rule: null }
  | { allowed: false; retryAt: Date; rule: "interval" | "pending" };

function normalizeCount(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

export function normalizeOfferPacing(input: { intervalMinutes?: number | null; maxPending?: number | null } | undefined | null): OfferPacingConfig {
  return {
    // DEC-151: no interval between offers, whatever the queue still stores.
    intervalMinutes: 0,
    maxPending: normalizeCount(input?.maxPending, DEFAULT_MAX_PENDING_OFFERS),
  };
}

export function isOfferPacingEnabled(config: OfferPacingConfig) {
  return config.intervalMinutes > 0 || config.maxPending > 0;
}

/**
 * Decides whether a broker can receive one more automatic offer now.
 * `offers` are the broker's offers in the queue. CANCELLED offers never count:
 * they are technical failures (no phone, send error), not contact with the broker.
 */
export function evaluateBrokerOfferPacing(offers: PacingOffer[], config: OfferPacingConfig, now: Date = new Date(), lastAssignedAt: Date | null = null): OfferPacingDecision {
  let retryAt: Date | null = null;
  let rule: "interval" | "pending" | null = null;
  const keepLater = (candidate: Date, candidateRule: "interval" | "pending") => {
    if (!retryAt || candidate > retryAt) {
      retryAt = candidate;
      rule = candidateRule;
    }
  };

  const counted = offers.filter((offer) => offer.status !== "CANCELLED");

  if (config.intervalMinutes > 0 && (counted.length || lastAssignedAt)) {
    const newestOfferAt = counted.reduce<Date | null>((latest, offer) => !latest || offer.offeredAt > latest ? offer.offeredAt : latest, null);
    const newest = lastAssignedAt && (!newestOfferAt || lastAssignedAt > newestOfferAt) ? lastAssignedAt : newestOfferAt!;
    const releasedAt = new Date(newest.getTime() + config.intervalMinutes * 60_000);
    if (releasedAt > now) keepLater(releasedAt, "interval");
  }

  if (config.maxPending > 0) {
    const pending = counted.filter((offer) => PENDING_STATUSES.has(offer.status) && offer.expiresAt > now);
    if (pending.length >= config.maxPending) {
      // A slot frees up when enough of the pending offers expire (or are answered).
      const byExpiry = pending.map((offer) => offer.expiresAt).sort((a, b) => a.getTime() - b.getTime());
      const freesAt = byExpiry[pending.length - config.maxPending];
      const recheckAt = new Date(now.getTime() + PENDING_OFFER_RECHECK_MS);
      keepLater(freesAt < recheckAt ? freesAt : recheckAt, "pending");
    }
  }

  return retryAt && rule ? { allowed: false, retryAt, rule } : { allowed: true, retryAt: null, rule: null };
}

/** Earliest moment any of the paced-out brokers can receive an offer again. */
export function earliestPacingRetryAt(decisions: OfferPacingDecision[]): Date | null {
  return decisions.reduce<Date | null>((earliest, decision) => {
    if (decision.allowed) return earliest;
    return !earliest || decision.retryAt < earliest ? decision.retryAt : earliest;
  }, null);
}
