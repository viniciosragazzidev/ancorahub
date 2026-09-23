/**
 * Offer pacing: protects a broker from a flood of simultaneous offers (for
 * example when a backlog is released at the start of a duty window).
 *
 * Two independent rules, both configured per queue:
 *  - interval: at least N minutes between two offers to the same broker;
 *  - max pending: at most M offers awaiting a response at the same time.
 * A value of 0 disables the corresponding rule.
 */
export const DEFAULT_OFFER_INTERVAL_MINUTES = 5;
export const DEFAULT_MAX_PENDING_OFFERS = 1;

const PENDING_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);

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
    intervalMinutes: normalizeCount(input?.intervalMinutes, DEFAULT_OFFER_INTERVAL_MINUTES),
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
export function evaluateBrokerOfferPacing(offers: PacingOffer[], config: OfferPacingConfig, now: Date = new Date()): OfferPacingDecision {
  let retryAt: Date | null = null;
  let rule: "interval" | "pending" | null = null;
  const keepLater = (candidate: Date, candidateRule: "interval" | "pending") => {
    if (!retryAt || candidate > retryAt) {
      retryAt = candidate;
      rule = candidateRule;
    }
  };

  const counted = offers.filter((offer) => offer.status !== "CANCELLED");

  if (config.intervalMinutes > 0 && counted.length) {
    const newest = counted.reduce((latest, offer) => (offer.offeredAt > latest ? offer.offeredAt : latest), counted[0].offeredAt);
    const releasedAt = new Date(newest.getTime() + config.intervalMinutes * 60_000);
    if (releasedAt > now) keepLater(releasedAt, "interval");
  }

  if (config.maxPending > 0) {
    const pending = counted.filter((offer) => PENDING_STATUSES.has(offer.status) && offer.expiresAt > now);
    if (pending.length >= config.maxPending) {
      // A slot frees up when enough of the pending offers expire (or are answered).
      const byExpiry = pending.map((offer) => offer.expiresAt).sort((a, b) => a.getTime() - b.getTime());
      keepLater(byExpiry[pending.length - config.maxPending], "pending");
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
