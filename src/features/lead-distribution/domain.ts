import type { AssignmentStrategy } from "./types";

export type EligibleBroker = { id: string; createdAt: Date; activeLeads: number; capacity: number | null };

export type IntelligentDistributionPolicy = {
  excludedBrokerIds: string[];
  excludedBranchIds: string[];
  allowedBrokerIds?: string[];
  allowedBranchIds?: string[];
  ranking: { enabled: boolean; conversionWeight: number; slaWeight: number; manualPriorityWeight: number };
};

export type RankedBroker = EligibleBroker & { onDuty: boolean; conversionRate: number; slaRate: number; manualPriority: number; idleSince: Date | null; rankingScore: number };

export const defaultIntelligentDistributionPolicy: IntelligentDistributionPolicy = {
  excludedBrokerIds: [], excludedBranchIds: [], allowedBrokerIds: [], allowedBranchIds: [],
  ranking: { enabled: true, conversionWeight: 45, slaWeight: 35, manualPriorityWeight: 20 },
};

export function readDistributionPolicy(value: unknown): IntelligentDistributionPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultIntelligentDistributionPolicy;
  const raw = value as Partial<IntelligentDistributionPolicy>;
  return {
    excludedBrokerIds: Array.isArray(raw.excludedBrokerIds) ? raw.excludedBrokerIds.filter((id): id is string => typeof id === "string") : [],
    excludedBranchIds: Array.isArray(raw.excludedBranchIds) ? raw.excludedBranchIds.filter((id): id is string => typeof id === "string") : [],
    allowedBrokerIds: Array.isArray(raw.allowedBrokerIds) ? raw.allowedBrokerIds.filter((id): id is string => typeof id === "string") : [],
    allowedBranchIds: Array.isArray(raw.allowedBranchIds) ? raw.allowedBranchIds.filter((id): id is string => typeof id === "string") : [],
    ranking: { ...defaultIntelligentDistributionPolicy.ranking, ...(raw.ranking ?? {}) },
  };
}

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
  return normalized.includes("nenhum corretor") || normalized.includes("atingiram a capacity") || normalized.includes("modo manual") || normalized.includes("desativada") || normalized.includes("pausada") || normalized.includes("fila configurada pertence") || normalized.includes("nenhuma unidade elegível") || normalized.includes("fila geral não possui unidades");
}

/**
 * A queue tied to one unit can only select brokers from that unit. A general
 * queue is deliberately different: it may distribute only to the unit IDs
 * explicitly allowed in its policy, never to every tenant unit by default.
 */
export function resolveQueueCandidateBranchIds(input: {
  queueBranchId: string | null;
  allowedBranchIds: string[];
}) {
  if (input.queueBranchId) return [input.queueBranchId];
  return Array.from(new Set(input.allowedBranchIds));
}

export function distributionRetryDelayMilliseconds(attempt: number, baseSeconds: number) {
  return Math.min(baseSeconds * 1000 * (2 ** Math.max(attempt - 1, 0)), 30 * 60_000);
}
