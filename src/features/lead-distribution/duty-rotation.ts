/**
 * Plantão rotation (29/10, replaces the DEC-154 leveling inside a plantão): everyone has their turn.
 * The queue starts in the order brokers confirmed presence; whoever confirms later enters at the end
 * and is never made up for the leads that went out before. Every offer spends the turn, whatever its
 * outcome: an expired or declined offer is a skip taken (it still counts as an indication). A broker
 * blocked on their turn (paused, offer awaiting acceptance) keeps the position. Pure: no database.
 */

/** Skips in one plantão occurrence that pause the broker and warn the supervisor. */
export const DUTY_SKIP_PAUSE_LIMIT = 3;

export const SKIP_OFFER_STATUSES = ["EXPIRED", "DECLINED"] as const;

export function isSkipOfferStatus(status: string | null | undefined) {
  return (SKIP_OFFER_STATUSES as readonly string[]).includes(status ?? "");
}

export type RotationArrival = { brokerId: string; arrivedAt: Date | null };

/**
 * Order of arrival in the plantão: earliest presence confirmation first. Brokers without a
 * confirmation (presence not required) keep the roster order, ahead of nobody: they sort by the
 * plantão start they were given, which the caller passes as arrivedAt.
 */
export function rotationArrivalOrder(arrivals: readonly RotationArrival[]) {
  return arrivals
    .map((arrival, index) => ({ ...arrival, index }))
    .sort((left, right) => {
      const leftAt = left.arrivedAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightAt = right.arrivedAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return leftAt - rightAt || left.index - right.index;
    })
    .map((arrival) => arrival.brokerId)
    .filter((brokerId, index, ids) => ids.indexOf(brokerId) === index);
}

/**
 * The 3rd skip of the day in a plantão pauses the broker; resumed by the supervisor, the 6th pauses
 * again, and so on. The pause itself is conditional, so a repeated check never warns twice.
 */
export function skipReachesPauseLimit(skipsInDay: number) {
  return skipsInDay > 0 && skipsInDay % DUTY_SKIP_PAUSE_LIMIT === 0;
}
