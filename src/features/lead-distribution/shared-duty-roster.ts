export type SharedDutyAssignment = {
  id: string;
  brokerId: string;
  scheduleId: string;
  branchId?: string | null;
};

/**
 * Collapses a union of simultaneous rosters to one representing occurrence per
 * broker. An exact confirmed occurrence wins; otherwise the stable schedule id
 * keeps attribution deterministic for online schedules without check-in.
 */
export function selectBrokerDutyScheduleIds<T extends SharedDutyAssignment>(
  assignments: readonly T[],
  activeScheduleIds: ReadonlySet<string>,
  eligibleAssignmentIds: ReadonlySet<string>,
  confirmedPresenceAssignmentIds: ReadonlySet<string> = eligibleAssignmentIds,
) {
  const byBroker = new Map<string, T[]>();
  for (const assignment of assignments) {
    if (!activeScheduleIds.has(assignment.scheduleId) || !eligibleAssignmentIds.has(assignment.id)) continue;
    const rows = byBroker.get(assignment.brokerId) ?? [];
    rows.push(assignment);
    byBroker.set(assignment.brokerId, rows);
  }

  const scheduleByBroker = new Map<string, string>();
  for (const [brokerId, rows] of byBroker) {
    rows.sort((a, b) => a.scheduleId.localeCompare(b.scheduleId));
    const confirmed = rows.find((row) => confirmedPresenceAssignmentIds.has(row.id));
    scheduleByBroker.set(brokerId, (confirmed ?? rows[0]).scheduleId);
  }
  return scheduleByBroker;
}

/** Reconstructs only pre-attribution rows, using the same check-in preference as live distribution. */
export function inferLegacyLeadDutyScheduleId(input: {
  brokerId: string | null | undefined;
  leadBranchId: string | null | undefined;
  assignments: readonly SharedDutyAssignment[];
  activeScheduleIds: ReadonlySet<string>;
  eligibleAssignmentIds: ReadonlySet<string>;
  confirmedPresenceAssignmentIds: ReadonlySet<string>;
  branchIdBySchedule: ReadonlyMap<string, string | null>;
}) {
  if (!input.brokerId) return null;
  const assignments = input.assignments.filter((assignment) => assignment.brokerId === input.brokerId
    && (input.leadBranchId == null
      || (assignment.branchId ?? input.branchIdBySchedule.get(assignment.scheduleId)) == null
      || (assignment.branchId ?? input.branchIdBySchedule.get(assignment.scheduleId)) === input.leadBranchId));
  return selectBrokerDutyScheduleIds(
    assignments,
    input.activeScheduleIds,
    input.eligibleAssignmentIds,
    input.confirmedPresenceAssignmentIds,
  ).get(input.brokerId) ?? null;
}

export function selectLeadsForDutySchedule<T extends { dutyScheduleId: string | null; corretorId?: string | null }>(
  leads: readonly T[],
  scheduleId: string,
  includeLegacyUnattributed = false,
  legacyScheduleForLead?: (lead: T) => string | null,
) {
  return leads.filter((lead) => lead.dutyScheduleId === scheduleId
    // A lead still waiting for a broker belongs to the queue as a whole, so
    // every plantão sharing it keeps listing it under "Aguardando
    // distribuição" instead of it vanishing from all of their pages.
    // A row with a broker but no dutyScheduleId is pre-attribution history.
    // Keep it on the occurrence represented by that broker when we can infer
    // the roster/check-in; exact attribution always takes precedence.
    || (lead.dutyScheduleId === null && (lead.corretorId == null
      || includeLegacyUnattributed
      || legacyScheduleForLead?.(lead) === scheduleId)));
}
