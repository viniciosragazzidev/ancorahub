import { resolveDistributionCandidate, type IntelligentDistributionPolicy, type RankedBroker } from "./domain";
import type { AssignmentStrategy } from "./types";
import { pickNextByReceivedInDay } from "./received-in-day-core";

export const DUTY_QUEUE_HISTORY_WINDOW_DAYS = 30;

export function dutyQueueHistorySince(now: Date) {
  return new Date(now.getTime() - DUTY_QUEUE_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function manualQueueSettingKey(scheduleId: string, dutyDate: string) {
  return `manual-queue:${scheduleId}:${dutyDate}`;
}

export function manualQueueSettingKeyForBroker(
  scope: {
    scheduleIdByBroker: Readonly<Record<string, string | null | undefined>>;
    dutyDateBySchedule: Readonly<Record<string, string | null | undefined>>;
  },
  brokerId: string | null | undefined,
) {
  const scheduleId = brokerId ? scope.scheduleIdByBroker[brokerId] : null;
  const dutyDate = scheduleId ? scope.dutyDateBySchedule[scheduleId] : null;
  return scheduleId && dutyDate ? manualQueueSettingKey(scheduleId, dutyDate) : null;
}

export type DutyQueueCandidate = RankedBroker & { name: string; blockedReason?: string | null };

export function reconcileManualQueueOrder(current: readonly string[], rosterBrokerIds: readonly string[]) {
  const roster = new Set(rosterBrokerIds);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of current) {
    if (!roster.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  for (const id of rosterBrokerIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function rotateManualQueueAfterPick(order: readonly string[], brokerId: string) {
  return [...order.filter((id) => id !== brokerId), brokerId];
}

export function rotateManualQueueKeepingBlockedSlots(
  order: readonly string[],
  rosterBrokerIds: readonly string[],
  brokerId: string,
  blockedBrokerIds: readonly string[],
) {
  const blocked = new Set(blockedBrokerIds);
  const movableOrder = order.filter((id) => !blocked.has(id));
  return mergeEligibleOrderKeepingBlockedSlots(
    order,
    rosterBrokerIds,
    rotateManualQueueAfterPick(movableOrder, brokerId),
    blockedBrokerIds,
  );
}

/** Replaces only movable slots so blocked brokers keep their queue position. */
export function mergeEligibleOrderKeepingBlockedSlots(
  storedOrder: readonly string[],
  rosterBrokerIds: readonly string[],
  eligibleOrder: readonly string[],
  blockedBrokerIds: readonly string[],
) {
  const base = reconcileManualQueueOrder(storedOrder, rosterBrokerIds);
  const eligible = new Set(eligibleOrder);
  const blocked = new Set(blockedBrokerIds);
  const movable = base.filter((id) => eligible.has(id));
  const nextMovable = [...eligibleOrder.filter((id) => eligible.has(id)), ...movable.filter((id) => !eligibleOrder.includes(id))];
  let cursor = 0;
  const merged = base.map((id) => {
    if (blocked.has(id)) return id;
    return nextMovable[cursor++] ?? id;
  });
  return reconcileManualQueueOrder(merged, rosterBrokerIds);
}

export function pickManualQueueBroker(order: readonly string[], eligibleBrokerIds: readonly string[]) {
  const eligible = new Set(eligibleBrokerIds);
  return order.find((id) => eligible.has(id)) ?? null;
}

export function parseManualQueueValue(value: string | null | undefined): string[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) return null;
    return [...new Set(parsed)];
  } catch {
    return null;
  }
}

export type ManualQueuePick = {
  brokerId: string;
  scheduleId: string;
  nextOrder: string[];
  manual: true;
} | {
  brokerId: string | null;
  scheduleId: null;
  nextOrder: null;
  manual: false;
};

/** A schedule's manual rotation never changes the automatic schedule choice. */
export function chooseManualQueuePick(input: {
  lockAcquired: boolean;
  automaticBrokerId: string | null;
  pendingBrokerIds: readonly string[];
  scheduleIdByBroker: Readonly<Record<string, string | null | undefined>>;
  queueBySchedule: Readonly<Record<string, readonly string[] | undefined>>;
  rosterBrokerIdsBySchedule: Readonly<Record<string, readonly string[] | undefined>>;
  /** Plantão rotation (29/10): with no saved queue yet, it starts from the roster (arrival order). */
  seedMissing?: boolean;
}): ManualQueuePick {
  // Rotation (30/10): when the automatic first is not on a plantão, the group comes from the first
  // candidate who is, so the lead never skips the turn just because of who the resolver ranked first.
  const automatic = input.automaticBrokerId && (input.scheduleIdByBroker[input.automaticBrokerId] || !input.seedMissing)
    ? input.automaticBrokerId
    : input.pendingBrokerIds.find((id) => input.scheduleIdByBroker[id]) ?? input.automaticBrokerId;
  const scheduleId = automatic ? input.scheduleIdByBroker[automatic] ?? null : null;
  const stored = scheduleId ? input.queueBySchedule[scheduleId] ?? (input.seedMissing ? [] : undefined) : undefined;
  if (!input.lockAcquired || !automatic || !scheduleId || !stored) {
    return { brokerId: automatic, scheduleId: null, nextOrder: null, manual: false };
  }

  // Keep stored IDs in place while temporarily blocked. Current candidates
  // append new brokers; an explicit reorder action cleans up removed roster IDs.
  // In the rotation, an eligible broker missing from the roster still gets a slot (at the end).
  const groupEligibleIds = input.pendingBrokerIds.filter((id) => input.scheduleIdByBroker[id] === scheduleId);
  const rosterIds = [...new Set([...stored, ...(input.rosterBrokerIdsBySchedule[scheduleId] ?? []), ...(input.seedMissing ? groupEligibleIds : [])])];
  const reconciled = reconcileManualQueueOrder(stored, rosterIds);
  const selected = pickManualQueueBroker(reconciled, groupEligibleIds);
  if (!selected) return { brokerId: automatic, scheduleId: null, nextOrder: null, manual: false };
  const groupEligible = new Set(groupEligibleIds);
  const blockedIds = rosterIds.filter((id) => !groupEligible.has(id));
  return {
    brokerId: selected,
    scheduleId,
    nextOrder: rotateManualQueueKeepingBlockedSlots(reconciled, rosterIds, selected, blockedIds),
    manual: true,
  };
}

function rankingTieKey(candidate: RankedBroker, policy: IntelligentDistributionPolicy, strategy: AssignmentStrategy) {
  if (!policy.ranking.enabled && strategy === "round_robin") return "created:" + candidate.createdAt.getTime();
  if (!policy.ranking.enabled) return [Number(candidate.onDuty), candidate.receivedInDuty ?? 0, candidate.activeLeads].join(":");
  return [
    Number(candidate.onDuty),
    candidate.receivedInDuty ?? 0,
    candidate.unstartedLeads ?? 0,
    candidate.activeLeads,
    policy.ranking.enabled ? candidate.rankingScore : "ranking-off",
    candidate.idleSince?.getTime() ?? 0,
  ].join(":");
}

/**
 * Builds the board from the same candidate resolver used by distribution.
 * Manual order is applied only after the resolver filters ineligible brokers.
 */
export function previewQueueOrder(input: {
  candidates: readonly DutyQueueCandidate[];
  policy: IntelligentDistributionPolicy;
  strategy: AssignmentStrategy;
  receivedByBroker?: ReadonlyMap<string, number>;
  tierByBroker?: Readonly<Record<string, number>>;
  manualBrokerIds?: readonly string[] | null;
}): {
  order: DutyQueueCandidate[];
  blocked: Array<DutyQueueCandidate & { blockedReason: string }>;
  nextBrokerId: string | null;
  tiedBrokerIds: string[];
  manual: boolean;
} {
  const ready = input.candidates.filter((candidate) => !candidate.blockedReason);
  const blocked = input.candidates
    .filter((candidate): candidate is DutyQueueCandidate & { blockedReason: string } => Boolean(candidate.blockedReason))
    .map((candidate) => ({ ...candidate, blockedReason: candidate.blockedReason! }));
  const decision = resolveDistributionCandidate(ready, input.policy, input.strategy);
  const automaticNextId = input.receivedByBroker && input.strategy !== "round_robin"
    ? pickNextByReceivedInDay(decision.eligible.map((candidate) => candidate.id), input.receivedByBroker, input.tierByBroker)
    : decision.selected?.id ?? null;
  const resolvedOrder = automaticNextId
    ? [automaticNextId, ...decision.eligible.map((candidate) => candidate.id).filter((id) => id !== automaticNextId)]
    : decision.eligible.map((candidate) => candidate.id);
  const rosterIds = input.candidates.map((candidate) => candidate.id);
  const manualOrder = input.manualBrokerIds
    ? reconcileManualQueueOrder(input.manualBrokerIds, rosterIds)
    : null;
  const visibleOrder = manualOrder
    ? [...manualOrder.filter((id) => resolvedOrder.includes(id)), ...resolvedOrder.filter((id) => !manualOrder.includes(id))]
    : resolvedOrder;
  const byId = new Map(ready.map((candidate) => [candidate.id, candidate]));
  const order = visibleOrder.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  const nextBrokerId = order[0]?.id ?? null;
  const top = nextBrokerId ? byId.get(nextBrokerId) : null;
  const topTieGroup = !manualOrder && top
    ? order.filter((candidate) => input.receivedByBroker && input.strategy !== "round_robin"
      ? (input.tierByBroker?.[candidate.id] ?? 1) === (input.tierByBroker?.[top.id] ?? 1)
        && (input.receivedByBroker.get(candidate.id) ?? 0) === (input.receivedByBroker.get(top.id) ?? 0)
        && rankingTieKey(candidate, input.policy, input.strategy) === rankingTieKey(top, input.policy, input.strategy)
      : rankingTieKey(candidate, input.policy, input.strategy) === rankingTieKey(top, input.policy, input.strategy)).map((candidate) => candidate.id)
    : [];
  const tiedBrokerIds = topTieGroup.length > 1 ? topTieGroup : [];
  return { order, blocked, nextBrokerId, tiedBrokerIds, manual: Boolean(manualOrder) };
}

