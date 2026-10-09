/**
 * Escala by plantão type (DEC-138): each qualified broker has seats per type
 * and a modality; the allocator runs one type at a time so a broker's seats of
 * one type never fill another, and what was already given (other types, kept
 * from the previous revision) counts as a commitment. Pure: no I/O.
 */
import { generateDutyScheduleDraft } from "./duty-scheduling-engine";
import { modalityAllows, typeKeyOf, type MonthlyPlanAssignment, type MonthlyPlanOccurrence, type PlanSettings } from "./monthly-duty-plan";

type Window = { dayOfWeek: number; startsAt: string; endsAt: string };

export function applyForcedBrokers(occurrences: readonly MonthlyPlanOccurrence[], settings: Pick<PlanSettings, "brokers">): MonthlyPlanOccurrence[] {
  return occurrences.map((occurrence) => {
    const key = typeKeyOf(occurrence.typeId);
    const forced = settings.brokers
      .filter((broker) => broker.forcedTypeKeys.includes(key) && (broker.seats[key] ?? 0) > 0 && !occurrence.allowedBrokerIds.includes(broker.brokerId))
      .map((broker) => broker.brokerId);
    if (!forced.length) return occurrence;
    return { ...occurrence, allowedBrokerIds: [...occurrence.allowedBrokerIds, ...forced], forcedBrokerIds: [...new Set([...(occurrence.forcedBrokerIds ?? []), ...forced])] };
  });
}

export function generateTypedAssignments(input: {
  occurrences: readonly MonthlyPlanOccurrence[];
  settings: PlanSettings;
  windowsByBroker?: ReadonlyMap<string, readonly Window[]>;
  /** Assignments kept from outside this generation (other types / dates), with their occurrences. */
  commitments?: ReadonlyArray<{ brokerId: string; dutyDate: string; startsAt: string; endsAt: string }>;
}): MonthlyPlanAssignment[] {
  const assignments: MonthlyPlanAssignment[] = [];
  const byId = new Map(input.occurrences.map((occurrence) => [occurrence.id, occurrence]));
  const committed = new Map<string, Array<{ dutyDate: string; startsAt: string; endsAt: string }>>();
  for (const item of input.commitments ?? []) committed.set(item.brokerId, [...(committed.get(item.brokerId) ?? []), item]);

  for (const key of [...new Set(input.settings.typeKeys)].sort()) {
    const typeOccurrences = input.occurrences.filter((occurrence) => typeKeyOf(occurrence.typeId) === key);
    const brokers = input.settings.brokers.filter((broker) => (broker.seats[key] ?? 0) > 0);
    if (!typeOccurrences.length || !brokers.length) continue;
    const modality = new Map(brokers.map((broker) => [broker.brokerId, broker.modality]));
    const result = generateDutyScheduleDraft(
      brokers.map((broker) => ({
        id: broker.brokerId,
        quota: broker.seats[key] ?? 0,
        availabilityWindows: input.windowsByBroker?.get(broker.brokerId) ?? [],
        existingCommitments: committed.get(broker.brokerId) ?? [],
      })),
      typeOccurrences.map((occurrence) => ({
        ...occurrence,
        allowedBrokerIds: occurrence.allowedBrokerIds.filter((brokerId) => modality.has(brokerId) && modalityAllows(modality.get(brokerId)!, occurrence.attendanceMode)),
      })),
    );
    for (const assignment of result.assignments) {
      assignments.push(assignment);
      const occurrence = byId.get(assignment.occurrenceId)!;
      committed.set(assignment.brokerId, [...(committed.get(assignment.brokerId) ?? []), occurrence]);
    }
  }
  return assignments;
}
