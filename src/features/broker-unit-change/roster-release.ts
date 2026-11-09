import { shiftEnd } from "@/features/lead-distribution/monthly-duty-plan";

export type ReleasableAssignment = {
  id: string;
  dutyDate: string | null;
  startsAt: string;
  endsAt: string;
  /** Timezone of the plantão; São Paulo when unknown. */
  timezone?: string | null;
};

/**
 * Which plantão slots of the old unit a broker leaves when changing unit (DEC-170).
 * Weekly slots (no date) and dated slots that have not ended yet, including the one
 * running now, are closed; dated slots already over stay as history.
 */
export function selectAssignmentsToRelease<T extends ReleasableAssignment>(assignments: T[], now: Date) {
  return assignments.filter((assignment) => assignment.dutyDate === null
    || shiftEnd({ startsAt: assignment.startsAt, endsAt: assignment.endsAt, timezone: assignment.timezone || "America/Sao_Paulo" }, assignment.dutyDate).getTime() > now.getTime());
}
