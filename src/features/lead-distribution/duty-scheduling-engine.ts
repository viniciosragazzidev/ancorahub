export type DutySchedulingBroker = {
  id: string;
  quota: number;
  unavailableDates?: readonly string[];
  /** Empty/undefined retains the current CRM rule: no declared windows means open availability. */
  availabilityWindows?: readonly { dayOfWeek: number; startsAt: string; endsAt: string }[];
  existingCommitments?: readonly Pick<DutySchedulingOccurrence, "dutyDate" | "startsAt" | "endsAt">[];
};

export type DutySchedulingOccurrence = {
  id: string;
  scheduleId: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  minimumBrokers: number;
  maximumBrokers: number | null;
  assignedBrokerIds?: readonly string[];
  /** Optional branch-resolved eligibility. Omitted keeps pure allocator callers backward compatible. */
  allowedBrokerIds?: readonly string[];
};

export type ProposedDutyAssignment = { brokerId: string; occurrenceId: string };

export type DutySchedulingResult = {
  assignments: ProposedDutyAssignment[];
  quotas: Array<{ brokerId: string; required: number; assigned: number; missing: number }>;
  occurrences: Array<{ occurrenceId: string; minimum: number; assigned: number; maximum: number | null; belowMinimum: boolean }>;
};

function interval(occurrence: DutySchedulingOccurrence) {
  return { start: Date.parse(`${occurrence.dutyDate}T${occurrence.startsAt}`), end: Date.parse(`${occurrence.dutyDate}T${occurrence.endsAt}`) };
}

function overlaps(a: DutySchedulingOccurrence, b: DutySchedulingOccurrence) {
  if (a.dutyDate !== b.dutyDate) return false;
  const left = interval(a);
  const right = interval(b);
  return left.start < right.end && left.end > right.start;
}

/**
 * Deterministic draft allocator. It consumes already-resolved tenant-scoped
 * occurrences and never persists or publishes assignments. Type is intentionally
 * absent because the approved domain treats it as classification only.
 */
export function generateDutyScheduleDraft(
  brokers: readonly DutySchedulingBroker[],
  occurrences: readonly DutySchedulingOccurrence[],
): DutySchedulingResult {
  const normalizedOccurrences = [...occurrences].sort((a, b) =>
    a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
  );
  const eligibleOccurrences = new Map<string, DutySchedulingOccurrence[]>();
  for (const broker of brokers) {
    const blockedDates = new Set(broker.unavailableDates ?? []);
    const windows = broker.availabilityWindows ?? [];
    eligibleOccurrences.set(broker.id, normalizedOccurrences.filter((occurrence) =>
      !blockedDates.has(occurrence.dutyDate)
      && (!occurrence.allowedBrokerIds || occurrence.allowedBrokerIds.includes(broker.id))
      && (windows.length === 0 || windows.some((window) => {
        const dayOfWeek = new Date(`${occurrence.dutyDate}T12:00:00Z`).getUTCDay();
        return window.dayOfWeek === dayOfWeek && window.startsAt <= occurrence.startsAt && window.endsAt >= occurrence.endsAt;
      }))
      && !(occurrence.assignedBrokerIds ?? []).includes(broker.id),
    ));
  }

  const assignments: ProposedDutyAssignment[] = [];
  const assignmentHistory = new Map<string, DutySchedulingOccurrence[]>();
  const occupancy = new Map(normalizedOccurrences.map((occurrence) => [occurrence.id, occurrence.assignedBrokerIds?.length ?? 0]));
  const remaining = new Map(brokers.map((broker) => [broker.id, Math.max(0, Math.trunc(broker.quota))]));
  const candidateCounts = new Map(brokers.map((broker) => [broker.id, eligibleOccurrences.get(broker.id)?.length ?? 0]));

  const required = new Map(remaining);
  const assignedCount = (brokerId: string) => (required.get(brokerId) ?? 0) - (remaining.get(brokerId) ?? 0);
  const weekKey = (date: string) => `${date.slice(0, 7)}-${Math.ceil(Number(date.slice(8, 10)) / 7)}`;

  /** Best occurrence for this broker now, or null when nothing valid is left. */
  const pickOccurrence = (broker: DutySchedulingBroker) => {
    const history = assignmentHistory.get(broker.id) ?? [];
    const commitments = broker.existingCommitments ?? [];
    const valid = (eligibleOccurrences.get(broker.id) ?? []).filter((occurrence) => {
      const assigned = occupancy.get(occurrence.id) ?? 0;
      if (occurrence.maximumBrokers !== null && assigned >= occurrence.maximumBrokers) return false;
      return !history.some((item) => item.id === occurrence.id || overlaps(item, occurrence))
        && !commitments.some((item) => overlaps(item as DutySchedulingOccurrence, occurrence));
    });
    if (!valid.length) return null;
    const nearest = (occurrence: DutySchedulingOccurrence) =>
      history.length ? Math.min(...history.map((item) => Math.abs(Date.parse(item.dutyDate) - Date.parse(occurrence.dutyDate)))) : Number.POSITIVE_INFINITY;
    const weekLoad = (occurrence: DutySchedulingOccurrence) => history.filter((item) => weekKey(item.dutyDate) === weekKey(occurrence.dutyDate)).length;
    const belowMinimum = (occurrence: DutySchedulingOccurrence) => ((occupancy.get(occurrence.id) ?? 0) < occurrence.minimumBrokers ? 0 : 1);
    return [...valid].sort((a, b) =>
      // 1) fill minimums first, 2) then the emptiest occurrence (in brokers, one unit
      // for every occurrence), 3) then spread the broker across weeks and dates.
      belowMinimum(a) - belowMinimum(b)
      || (occupancy.get(a.id) ?? 0) - (occupancy.get(b.id) ?? 0)
      || weekLoad(a) - weekLoad(b)
      || (nearest(b) === nearest(a) ? 0 : nearest(b) > nearest(a) ? 1 : -1)
      || a.dutyDate.localeCompare(b.dutyDate)
      || a.startsAt.localeCompare(b.startsAt)
      || a.id.localeCompare(b.id),
    )[0];
  };

  // Round-robin: one occurrence per broker per round, the broker furthest behind
  // their quota first. Filling one quota entirely before the next would let the
  // first brokers take every scarce slot.
  const exhausted = new Set<string>();
  let assignedThisRound = true;
  while (assignedThisRound) {
    assignedThisRound = false;
    const round = brokers
      .filter((broker) => (remaining.get(broker.id) ?? 0) > 0 && !exhausted.has(broker.id))
      .sort((a, b) => {
        const progressA = assignedCount(a.id) / Math.max(1, required.get(a.id) ?? 1);
        const progressB = assignedCount(b.id) / Math.max(1, required.get(b.id) ?? 1);
        return progressA - progressB
          || (candidateCounts.get(a.id) ?? 0) - (candidateCounts.get(b.id) ?? 0)
          || a.id.localeCompare(b.id);
      });
    for (const broker of round) {
      const selected = pickOccurrence(broker);
      if (!selected) {
        // Nothing valid now means nothing valid later: occupancy only grows.
        exhausted.add(broker.id);
        continue;
      }
      assignments.push({ brokerId: broker.id, occurrenceId: selected.id });
      occupancy.set(selected.id, (occupancy.get(selected.id) ?? 0) + 1);
      assignmentHistory.set(broker.id, [...(assignmentHistory.get(broker.id) ?? []), selected]);
      remaining.set(broker.id, (remaining.get(broker.id) ?? 0) - 1);
      assignedThisRound = true;
    }
  }

  return {
    assignments,
    quotas: brokers.map((broker) => {
      const assigned = assignments.filter((assignment) => assignment.brokerId === broker.id).length;
      return { brokerId: broker.id, required: Math.max(0, Math.trunc(broker.quota)), assigned, missing: Math.max(0, Math.trunc(broker.quota)) - assigned };
    }),
    occurrences: normalizedOccurrences.map((occurrence) => {
      const assigned = occupancy.get(occurrence.id) ?? 0;
      return { occurrenceId: occurrence.id, minimum: occurrence.minimumBrokers, assigned, maximum: occurrence.maximumBrokers, belowMinimum: assigned < occurrence.minimumBrokers };
    }),
  };
}
