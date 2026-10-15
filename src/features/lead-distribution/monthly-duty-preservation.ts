/**
 * What a publication does with the dated roster rows of the previous escala
 * that are NOT in the new draft (pure, tested). Rows are never dropped just
 * because the draft does not list them: only the plantões that this
 * generation redrew (the chosen types, inside the period) may leave the
 * roster. Everything else is kept active, so a broker who is really on duty
 * does not disappear in the next publication.
 */

export type LeftoverRow = {
  id: string;
  scheduleId: string;
  brokerId: string;
  /** YYYY-MM-DD, the day of the plantão. */
  dutyDate: string;
  startsAt: string;
  monthlyPlanId: string | null;
};

export type PreservationDecision = {
  /** Rows that leave the roster: redrawn plantões of the chosen types that have not started. */
  removeIds: string[];
  /** Rows that stay active. `occurrenceId` is set when the draft lists that plantão (it goes back into the new escala). */
  preserved: Array<{ row: LeftoverRow; occurrenceId: string | null }>;
};

export function decideLeftoverRows(input: {
  leftovers: readonly LeftoverRow[];
  /** occurrence ids of the draft (`scheduleId:dutyDate`). */
  draftOccurrenceIds: ReadonlySet<string>;
  /** Types the last generation redrew. null = an escala before this field existed: all types were redrawn. */
  generatedTypeKeys: readonly string[] | null;
  rangeFrom: string;
  rangeUntil: string;
  /** Type key of a schedule (NO_TYPE_KEY when none). */
  typeKeyOfSchedule: (scheduleId: string) => string;
  /** True when the plantão already started: nobody leaves the roster mid-shift. */
  started: (row: LeftoverRow) => boolean;
  occurrenceIdOf: (scheduleId: string, dutyDate: string) => string;
}): PreservationDecision {
  const removeIds: string[] = [];
  const preserved: PreservationDecision["preserved"] = [];
  for (const row of input.leftovers) {
    const redrawn = (input.generatedTypeKeys === null || input.generatedTypeKeys.includes(input.typeKeyOfSchedule(row.scheduleId)))
      && row.dutyDate >= input.rangeFrom
      && row.dutyDate <= input.rangeUntil;
    if (redrawn && !input.started(row)) {
      removeIds.push(row.id);
      continue;
    }
    const occurrenceId = input.occurrenceIdOf(row.scheduleId, row.dutyDate);
    preserved.push({ row, occurrenceId: input.draftOccurrenceIds.has(occurrenceId) ? occurrenceId : null });
  }
  return { removeIds, preserved };
}
