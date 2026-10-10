/**
 * Offer statistics of the team and the position of each broker.
 * Pure: the numbers come from broker-stats.ts (one grouped query).
 */

export type BrokerOfferStats = {
  brokerId: string;
  /** Offers received in the period (cancelled ones excluded). */
  offered: number;
  accepted: number;
  /** Median seconds from the offer to the accept (null when nothing was accepted). */
  medianAcceptSeconds: number | null;
};

export type RankKey = "accepted" | "speed" | "rate";
export type RankPosition = { key: RankKey; position: number; total: number };

/** A broker only enters a ranking with enough data (one lucky accept is not "the fastest"). */
export const RANK_MINIMUMS = { speed: 3, rate: 5 } as const;

export const RANK_LABEL: Record<RankKey, string> = {
  accepted: "nos que mais aceitam",
  speed: "no aceite mais rápido",
  rate: "na taxa de aceite",
};

export function acceptRate(stats: Pick<BrokerOfferStats, "offered" | "accepted">) {
  return stats.offered > 0 ? stats.accepted / stats.offered : 0;
}

/** Competition ranking (1, 2, 2, 4): ties share the position. */
function positionOf<T>(rows: T[], brokerId: string, idOf: (row: T) => string, compare: (a: T, b: T) => number) {
  const sorted = [...rows].sort(compare);
  const index = sorted.findIndex((row) => idOf(row) === brokerId);
  if (index < 0) return null;
  const mine = sorted[index]!;
  const position = sorted.findIndex((row) => compare(row, mine) === 0) + 1;
  return { position, total: sorted.length };
}

/** Where the broker stands in each ranking (absent when they do not qualify for it). */
export function rankBroker(team: BrokerOfferStats[], brokerId: string): RankPosition[] {
  const result: RankPosition[] = [];
  const active = team.filter((row) => row.offered > 0);

  const accepted = positionOf(active, brokerId, (row) => row.brokerId, (a, b) => b.accepted - a.accepted || acceptRate(b) - acceptRate(a));
  const me = active.find((row) => row.brokerId === brokerId);
  if (accepted && me && me.accepted > 0) result.push({ key: "accepted", ...accepted });

  const fast = team.filter((row) => row.medianAcceptSeconds !== null && row.accepted >= RANK_MINIMUMS.speed);
  const speed = positionOf(fast, brokerId, (row) => row.brokerId, (a, b) => a.medianAcceptSeconds! - b.medianAcceptSeconds!);
  if (speed) result.push({ key: "speed", ...speed });

  const rated = team.filter((row) => row.offered >= RANK_MINIMUMS.rate);
  const rate = positionOf(rated, brokerId, (row) => row.brokerId, (a, b) => acceptRate(b) - acceptRate(a));
  if (rate) result.push({ key: "rate", ...rate });

  return result;
}

/** "1 min 20 s", "45 s", "2 h 5 min". */
export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "sem dado";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    const rest = total % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** The headline of a position: "1º no aceite mais rápido". */
export function rankHeadline(rank: RankPosition) {
  return `${rank.position}º ${RANK_LABEL[rank.key]}`;
}
