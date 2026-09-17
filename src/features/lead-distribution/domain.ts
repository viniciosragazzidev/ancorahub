import type { AssignmentStrategy } from "./types";

export type EligibleBroker = { id: string; createdAt: Date; activeLeads: number; capacity: number | null };

export type IntelligentDistributionPolicy = {
  excludedBrokerIds: string[];
  excludedBranchIds: string[];
  allowedBrokerIds?: string[];
  allowedBranchIds?: string[];
  allowedSourceIds?: string[];
  ranking: { enabled: boolean; conversionWeight: number; slaWeight: number; manualPriorityWeight: number };
};

export type RankedBroker = EligibleBroker & {
  onDuty: boolean;
  conversionRate: number;
  slaRate: number;
  manualPriority: number;
  idleSince: Date | null;
  lastAssignedAt?: Date | null;
  unstartedLeads?: number;
  rankingScore: number;
};

export const defaultIntelligentDistributionPolicy: IntelligentDistributionPolicy = {
  excludedBrokerIds: [], excludedBranchIds: [], allowedBrokerIds: [], allowedBranchIds: [], allowedSourceIds: [],
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
    allowedSourceIds: Array.isArray(raw.allowedSourceIds) ? raw.allowedSourceIds.filter((id): id is string => typeof id === "string") : [],
    ranking: { ...defaultIntelligentDistributionPolicy.ranking, ...(raw.ranking ?? {}) },
  };
}

const BROKER_COOLDOWN_MS = 5 * 60 * 1000;

export function rankBrokers(brokers: RankedBroker[], policy: IntelligentDistributionPolicy, now = new Date()): RankedBroker[] {
  const nowMs = now.getTime();
  return brokers
    .filter((broker) => !policy.excludedBrokerIds.includes(broker.id) && (broker.capacity === null || broker.activeLeads < broker.capacity))
    .sort((a, b) => {
      // 1. Plantão (On-Duty) ativo primeiro
      if (Number(b.onDuty) !== Number(a.onDuty)) return Number(b.onDuty) - Number(a.onDuty);

      // 2. Cooldown de 5 minutos (corretor que nao recebeu lead nos ultimos 5 min tem prioridade)
      const aCooled = a.lastAssignedAt ? (nowMs - a.lastAssignedAt.getTime() < BROKER_COOLDOWN_MS) : false;
      const bCooled = b.lastAssignedAt ? (nowMs - b.lastAssignedAt.getTime() < BROKER_COOLDOWN_MS) : false;
      if (aCooled !== bCooled) return Number(aCooled) - Number(bCooled);

      // 3. Menor quantidade de leads sem iniciar atendimento
      const aUnstarted = a.unstartedLeads ?? 0;
      const bUnstarted = b.unstartedLeads ?? 0;
      if (aUnstarted !== bUnstarted) return aUnstarted - bUnstarted;

      // 4. Menor quantidade de leads ativos totais
      if (a.activeLeads !== b.activeLeads) return a.activeLeads - b.activeLeads;

      // 5. Pontuação de desempenho / ranking inteligente
      if (policy.ranking.enabled && b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;

      // 6. Maior tempo em descanso (idleSince)
      const aIdle = a.idleSince?.getTime() ?? 0;
      const bIdle = b.idleSince?.getTime() ?? 0;
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
  const overflowSelected = selected ?? rankBrokers(
    brokers.map((broker) => ({ ...broker, capacity: null })),
    policy,
  )[0] ?? null;
  return { eligible, selected, overflowSelected };
}

export function isValidDutyWindow(dayOfWeek: number, startsAt: string, endsAt: string) {
  return dayOfWeek >= 0 && dayOfWeek <= 6 && /^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt) && startsAt < endsAt;
}

export function getDutyCoverage(assignedBrokers: number, minimumBrokers: number) {
  const assigned = Math.max(0, Math.trunc(assignedBrokers));
  const minimum = Math.max(1, Math.trunc(minimumBrokers));
  return { assigned, minimum, missing: Math.max(0, minimum - assigned), covered: assigned >= minimum };
}

export type DistributionBranchCandidate = { id: string; activeLeads: number; createdAt: Date };

/** Stable load-based routing for intake that has no unit rule. */
export function selectDistributionBranch(branches: DistributionBranchCandidate[]): DistributionBranchCandidate | null {
  return [...branches].sort((a, b) =>
    a.activeLeads - b.activeLeads
      || a.createdAt.getTime() - b.createdAt.getTime()
      || a.id.localeCompare(b.id),
  )[0] ?? null;
}

export function isDeferredDistributionReason(reason: string) {
  const normalized = reason.toLocaleLowerCase("pt-BR");
  return (
    normalized.includes("nenhum corretor") ||
    normalized.includes("atingiram a capacity") ||
    normalized.includes("modo manual") ||
    normalized.includes("desativada") ||
    normalized.includes("pausada") ||
    normalized.includes("fila configurada pertence") ||
    normalized.includes("nenhuma unidade elegível") ||
    normalized.includes("fila geral não possui unidades") ||
    normalized.includes("próximo ciclo automático") ||
    normalized.includes("qualificação por ia") ||
    normalized.includes("qualificação em andamento")
  );
}

/**
 * Window during which a PENDING offer without a linked durable outbox row is
 * treated as an in-flight delivery attempt. `createLeadOffersForBrokers` links
 * the outbox row right after enqueueing, so a stale PENDING offer past this
 * window is abnormal and must not block the cycle forever.
 */
export const OFFER_ENQUEUE_GRACE_MS = 2 * 60 * 1000;

/**
 * A pending offer gives the selected broker provisional ownership so the lead
 * is immediately visible in the broker wallet and can be accepted there. The
 * `automatic_offer` source distinguishes this reversible link from a confirmed
 * attendance: decline or expiration may atomically rotate it to the next
 * eligible broker.
 */
export function buildPendingLeadOfferLeadUpdate(input: {
  targetBranchId: string;
  brokerId: string;
  now: Date;
}) {
  return {
    branchId: input.targetBranchId,
    corretorId: input.brokerId,
    status: "distributed" as const,
    distributionStatus: "assigned" as const,
    assignedAt: input.now,
    assignmentSource: "automatic_offer" as const,
    assignmentStrategy: "whatsapp_offer" as const,
    distributionUpdatedAt: input.now,
    stageEnteredAt: input.now,
    firstContactAt: null,
    serviceStartedAt: null,
    serviceStartedBy: null,
    motivoPerda: null,
    updatedAt: input.now,
  };
}

/**
 * A short grace protects a broker who accepted at the deadline while the
 * request was in flight. It only applies to the current provisional owner.
 */
export const LEAD_OFFER_ACCEPT_GRACE_MS = 60 * 1000;

const ACTIVE_OFFER_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);

/**
 * Whether an active offer must block the creation of a second offer for the
 * same lead. An offer with a linked outbox row (or unknown/legacy linkage) is
 * always blocking; a PENDING offer whose outbox row was not linked yet only
 * blocks during the enqueue grace window.
 */
export function isBlockingActiveOffer(
  offer: { status: string; offeredAt?: Date | null; expiresAt: Date; outboundMessageId?: string | null },
  now: Date,
) {
  if (!ACTIVE_OFFER_STATUSES.has(offer.status) || offer.expiresAt <= now) return false;
  // `undefined` means legacy/unknown linkage and keeps the historical blocking
  // behavior; an explicit `null` means the enqueue has not linked the row yet.
  if (offer.outboundMessageId !== null) return true;
  if (offer.status !== "PENDING" || !offer.offeredAt) return false;
  return now.getTime() - offer.offeredAt.getTime() <= OFFER_ENQUEUE_GRACE_MS;
}

export type LeadOfferAcceptanceDecision = {
  isExpired: boolean;
  isAlreadyAssigned: boolean;
  withinGrace: boolean;
  isAcceptable: boolean;
};

/** Pure accept-time decision shared by the offer webhook transaction. */
export function resolveLeadOfferAcceptance(
  input: { offerStatus: string; expiresAt: Date; leadCorretorId: string | null; brokerId: string },
  now: Date,
): LeadOfferAcceptanceDecision {
  const overdueMs = now.getTime() - input.expiresAt.getTime();
  const isProvisionalOwner = input.leadCorretorId === input.brokerId;
  const withinGrace = overdueMs > 0 && overdueMs <= LEAD_OFFER_ACCEPT_GRACE_MS && isProvisionalOwner;
  const isExpired = overdueMs > 0 && !withinGrace;
  const isAlreadyAssigned = Boolean(input.leadCorretorId && input.leadCorretorId !== input.brokerId);
  const isAcceptable = ACTIVE_OFFER_STATUSES.has(input.offerStatus) && !isExpired && !isAlreadyAssigned;
  return { isExpired, isAlreadyAssigned, withinGrace, isAcceptable };
}

/**
 * A queue tied to one unit can only select brokers from that unit. A general
 * queue is deliberately different: it may distribute only to the unit IDs
 * explicitly allowed in its policy, never to every tenant unit by default.
 */
export function resolveQueueCandidateBranchIds(input: {
  queueBranchId: string | null;
  allowedBranchIds: string[];
  leadBranchId?: string | null;
}) {
  if (input.queueBranchId) return [input.queueBranchId];
  const list = [...input.allowedBranchIds];
  // An unbound/general queue with no allow-list explicitly means all active
  // units. In that mode the lead's current branch must not pin the rotation;
  // the service resolves the eligible unit by current load. A lead branch is
  // only a fallback when the policy already constrains the candidate set.
  if (list.length > 0 && input.leadBranchId && !list.includes(input.leadBranchId)) {
    list.push(input.leadBranchId);
  }
  return Array.from(new Set(list));
}

export function resolveDistributionPolicyScope(
  queueId: string | null,
  profileKey: string | null,
) {
  return { queueId, profileKey };
}

/** A distribution hub (Matriz) receives leads for human redistribution only. */
export function isAutomaticDistributionBranch(branch: {
  status: "active" | "inactive";
  acceptingLeads: boolean;
  autoDistribute: boolean;
  isDistributionHub: boolean;
}) {
  return branch.status === "active" && branch.acceptingLeads && branch.autoDistribute && !branch.isDistributionHub;
}

export function distributionRetryDelayMilliseconds(attempt: number, baseSeconds: number) {
  return Math.min(baseSeconds * 1000 * (2 ** Math.max(attempt - 1, 0)), 30 * 60_000);
}

export function resolveLeadOfferCycle(input: {
  eligibleBrokerIds: string[];
  offers: Array<{ brokerId: string; status: string; offeredAt?: Date; expiresAt: Date; outboundMessageId?: string | null }>;
  cycleStartedAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const offers = input.cycleStartedAt
    ? input.offers.filter(
        (offer) => !offer.offeredAt || offer.offeredAt >= input.cycleStartedAt!,
      )
    : input.offers;
  const activeOffer = offers.find((offer) => isBlockingActiveOffer(offer, now));
  const attemptedBrokerIds = new Set(offers.map((offer) => offer.brokerId));
  const remainingBrokerIds = input.eligibleBrokerIds.filter(
    (brokerId) => !attemptedBrokerIds.has(brokerId),
  );

  return {
    activeBrokerId: activeOffer?.brokerId ?? null,
    activeExpiresAt: activeOffer?.expiresAt ?? null,
    attemptedBrokerIds,
    remainingBrokerIds,
    exhausted:
      !activeOffer &&
      input.eligibleBrokerIds.length > 0 &&
      remainingBrokerIds.length === 0 &&
      attemptedBrokerIds.size > 0,
  };
}
