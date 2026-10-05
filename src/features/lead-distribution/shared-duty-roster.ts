export type SharedDutyAssignment = {
  id: string;
  brokerId: string;
  scheduleId: string;
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

export function selectLeadsForDutySchedule<T extends { dutyScheduleId: string | null }>(leads: readonly T[], scheduleId: string, includeLegacyUnattributed = false) {
  return leads.filter((lead) => lead.dutyScheduleId === scheduleId || includeLegacyUnattributed && lead.dutyScheduleId === null);
}
