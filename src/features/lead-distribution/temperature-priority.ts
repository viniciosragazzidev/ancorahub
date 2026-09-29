/**
 * Distribution priority by lead temperature: when several leads wait for a
 * broker, hot goes first, then warm, then cold. A lead with no temperature
 * (never qualified, qualified without a class, waiting for a human) ranks with
 * the warm ones. Pure data, shared by the engine and the waiting lists.
 */
export type TemperatureRank = 0 | 1 | 2;

export function temperatureRank(qualificationStatus: string | null | undefined): TemperatureRank {
  if (qualificationStatus === "hot") return 0;
  if (qualificationStatus === "cold") return 2;
  return 1;
}

/** Stable: leads of the same temperature keep the order they came in. */
export function sortByTemperaturePriority<T extends { qualificationStatus?: string | null }>(leads: readonly T[]): T[] {
  return leads
    .map((lead, index) => ({ lead, index, rank: temperatureRank(lead.qualificationStatus) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ lead }) => lead);
}

/** Groups items by rank, hottest first, keeping their order inside each group. */
export function groupByTemperatureRank<T>(items: readonly T[], rankOf: (item: T) => TemperatureRank): T[][] {
  const groups: T[][] = [[], [], []];
  for (const item of items) groups[rankOf(item)].push(item);
  return groups.filter((group) => group.length > 0);
}
