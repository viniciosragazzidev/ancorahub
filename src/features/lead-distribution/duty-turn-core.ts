import { reconcileManualQueueOrder } from "./duty-queue-order";
import { isSkipOfferStatus, rotationArrivalOrder } from "./duty-rotation";

export type DutyTurnRosterEntry = { brokerId: string; confirmedAt: Date | null; canReceive: boolean };
export type DutyTurnOffer = { brokerId: string; status: string; offeredAt: Date; expiresAt: Date };

export type DutyBrokerTurn = {
  role: "current" | "next" | "previous" | null;
  /** Place among those who can receive now (1 = next). */
  position: number | null;
  outcome: "accepted" | "skip" | "waiting" | null;
  skips: number;
};

export type DutyTurnState = {
  byBroker: Record<string, DutyBrokerTurn>;
  rank: Record<string, number>;
  current: { brokerId: string; offeredAt: string } | null;
  previous: { brokerId: string; offeredAt: string; outcome: "accepted" | "skip" | "waiting" } | null;
  nextBrokerId: string | null;
  /** Whole saved turn (blocked keep their slots) and who can be moved in it now (29/10). */
  order: string[];
  queue: string[];
};

const ACTIVE_OFFER = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);

/**
 * Who is receiving now, who is next and who received last in a plantão's rotation, and the order
 * of the cards (receiving now, then the queue, then who cannot receive now). Pure.
 */
export function resolveDutyTurns(input: { stored: readonly string[] | null; roster: readonly DutyTurnRosterEntry[]; offers: readonly DutyTurnOffer[]; now: Date }): DutyTurnState {
  const arrival = rotationArrivalOrder(input.roster.map((entry) => ({ brokerId: entry.brokerId, arrivedAt: entry.confirmedAt })));
  const order = reconcileManualQueueOrder(input.stored ?? [], arrival);
  const current = [...input.offers].reverse().find((offer) => ACTIVE_OFFER.has(offer.status) && offer.expiresAt > input.now) ?? null;
  const previous = [...input.offers].reverse().find((offer) => offer !== current) ?? null;
  const ready = new Set(input.roster.filter((entry) => entry.canReceive).map((entry) => entry.brokerId));
  const queue = order.filter((brokerId) => ready.has(brokerId) && brokerId !== current?.brokerId);
  const byBroker: Record<string, DutyBrokerTurn> = {};
  const rank: Record<string, number> = {};
  for (const entry of input.roster) {
    const position = queue.indexOf(entry.brokerId);
    const role = current?.brokerId === entry.brokerId ? "current"
      : position === 0 ? "next"
        : previous?.brokerId === entry.brokerId ? "previous" : null;
    byBroker[entry.brokerId] = {
      role,
      position: position >= 0 ? position + 1 : null,
      outcome: role === "previous" && previous ? (previous.status === "ACCEPTED" ? "accepted" : isSkipOfferStatus(previous.status) ? "skip" : "waiting") : null,
      skips: input.offers.filter((offer) => offer.brokerId === entry.brokerId && isSkipOfferStatus(offer.status)).length,
    };
    rank[entry.brokerId] = role === "current" ? -1 : position >= 0 ? position : queue.length + 1 + order.indexOf(entry.brokerId);
  }
  return {
    byBroker,
    rank,
    current: current ? { brokerId: current.brokerId, offeredAt: current.offeredAt.toISOString() } : null,
    previous: previous ? { brokerId: previous.brokerId, offeredAt: previous.offeredAt.toISOString(), outcome: previous.status === "ACCEPTED" ? "accepted" : isSkipOfferStatus(previous.status) ? "skip" : "waiting" } : null,
    nextBrokerId: queue[0] ?? null,
    order,
    queue,
  };
}

/**
 * The director drags a broker in front of another on the plantão cards (29/10): only who can
 * receive now moves; whoever is receiving or blocked keeps the slot. Null when the move is invalid.
 */
export function moveDutyTurn(state: Pick<DutyTurnState, "order" | "queue">, activeId: string, overId: string): string[] | null {
  const from = state.queue.indexOf(activeId);
  const to = state.queue.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  const queue = [...state.queue];
  queue.splice(to, 0, ...queue.splice(from, 1));
  const movable = new Set(state.queue);
  let cursor = 0;
  return state.order.map((brokerId) => movable.has(brokerId) ? queue[cursor++] : brokerId);
}
