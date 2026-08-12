import type { AssignmentStrategy } from "./types";

export type EligibleBroker = { id: string; createdAt: Date; activeLeads: number; capacity: number | null };

export type IntelligentDistributionPolicy = {
  excludedBrokerIds: string[];
  excludedBranchIds: string[];
  ranking: { enabled: boolean; conversionWeight: number; slaWeight: number; manualPriorityWeight: number };
};

export type RankedBroker = EligibleBroker & { onDuty: boolean; conversionRate: number; slaRate: number; manualPriority: number; idleSince: Date | null; rankingScore: number };

export const defaultIntelligentDistributionPolicy: IntelligentDistributionPolicy = {
  excludedBrokerIds: [], excludedBranchIds: [],
  ranking: { enabled: true, conversionWeight: 45, slaWeight: 35, manualPriorityWeight: 20 },
};

export function rankBrokers(brokers: RankedBroker[], policy: IntelligentDistributionPolicy): RankedBroker[] {
  return brokers
    .filter((broker) => !policy.excludedBrokerIds.includes(broker.id) && (broker.capacity === null || broker.activeLeads < broker.capacity))
    .sort((a, b) => {
      if (Number(b.onDuty) !== Number(a.onDuty)) return Number(b.onDuty) - Number(a.onDuty);
      if (policy.ranking.enabled && b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      if (a.activeLeads !== b.activeLeads) return a.activeLeads - b.activeLeads;
      const aIdle = a.idleSince?.getTime() ?? Number.POSITIVE_INFINITY;
      const bIdle = b.idleSince?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aIdle !== bIdle) return aIdle - bIdle;
      return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
    });
}

export function calculateBrokerRankingScore(input: Pick<RankedBroker, "conversionRate" | "slaRate" | "manualPriority">, policy: IntelligentDistributionPolicy) {
  const weights = policy.ranking;
  return Math.round(input.conversionRate * weights.conversionWeight + input.slaRate * weights.slaWeight + input.manualPriority * weights.manualPriorityWeight);
}

export function chooseBroker(brokers: EligibleBroker[], strategy: AssignmentStrategy): EligibleBroker | null {
  const eligible = brokers.filter((broker) => broker.capacity === null || broker.activeLeads < broker.capacity);
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => strategy === "round_robin" ? a.createdAt.getTime() - b.createdAt.getTime() : a.activeLeads - b.activeLeads || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
}

/** Shared final decision for automatic distribution and the dry-run simulator. */
export function resolveDistributionCandidate(
  brokers: RankedBroker[],
  policy: IntelligentDistributionPolicy,
  strategy: AssignmentStrategy,
) {
  const eligible = rankBrokers(brokers, policy);
  const selected = policy.ranking.enabled
    ? eligible[0] ?? null
    : chooseBroker(eligible, strategy === "round_robin" ? "round_robin" : "capacity");
  return { eligible, selected };
}

export function isValidDutyWindow(dayOfWeek: number, startsAt: string, endsAt: string) {
  return dayOfWeek >= 0 && dayOfWeek <= 6 && /^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt) && startsAt < endsAt;
}

export function getDutyCoverage(assignedBrokers: number, minimumBrokers: number) {
  const assigned = Math.max(0, Math.trunc(assignedBrokers));
  const minimum = Math.max(1, Math.trunc(minimumBrokers));
  return { assigned, minimum, missing: Math.max(0, minimum - assigned), covered: assigned >= minimum };
}

export function isDeferredDistributionReason(reason: string) {
  const normalized = reason.toLocaleLowerCase("pt-BR");
  return normalized.includes("nenhum corretor") || normalized.includes("atingiram a capacidade") || normalized.includes("modo manual") || normalized.includes("desativada") || normalized.includes("pausada");
}

export function distributionRetryDelayMilliseconds(attempt: number, baseSeconds: number) {
  return Math.min(baseSeconds * 1000 * (2 ** Math.max(attempt - 1, 0)), 30 * 60_000);
}
