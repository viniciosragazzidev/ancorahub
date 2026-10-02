/**
 * Shifts of a plantão: a plantão split at a time (e.g. 09:00–18:00 at 13:30)
 * has a morning and an afternoon shift. Each broker on the roster is on one
 * of them or the whole day — their roster window (startsAt/endsAt) is that
 * shift, so the distribution and the presence call already follow it.
 * Pure: no I/O.
 */

export const DEFAULT_SHIFT_SPLIT_AT = "13:30";

export type DutyShiftKey = "manha" | "tarde" | "dia";

export type DutyShift = { key: DutyShiftKey; label: string; startsAt: string; endsAt: string };

const hhmm = (time: string) => time.slice(0, 5);

/** A split time strictly inside the plantão, or null. */
export function validShiftSplit(schedule: { startsAt: string; endsAt: string }, splitAt: string | null | undefined) {
  if (!splitAt || !/^\d{2}:\d{2}/.test(splitAt)) return null;
  const split = hhmm(splitAt);
  return split > hhmm(schedule.startsAt) && split < hhmm(schedule.endsAt) ? split : null;
}

/** Morning, afternoon and the whole day of a split plantão; null when it is not split. */
export function dutyShifts(schedule: { startsAt: string; endsAt: string; shiftSplitAt?: string | null }): DutyShift[] | null {
  const split = validShiftSplit(schedule, schedule.shiftSplitAt);
  if (!split) return null;
  const start = hhmm(schedule.startsAt);
  const end = hhmm(schedule.endsAt);
  return [
    { key: "manha", label: `Manhã · ${start}–${split}`, startsAt: start, endsAt: split },
    { key: "tarde", label: `Tarde · ${split}–${end}`, startsAt: split, endsAt: end },
    { key: "dia", label: `Dia todo · ${start}–${end}`, startsAt: start, endsAt: end },
  ];
}

/** Which shift a broker's roster window is (null when the plantão is not split or the window is custom). */
export function assignmentShift(
  schedule: { startsAt: string; endsAt: string; shiftSplitAt?: string | null },
  assignment: { startsAt: string; endsAt: string },
): DutyShiftKey | null {
  const shifts = dutyShifts(schedule);
  if (!shifts) return null;
  return shifts.find((shift) => shift.startsAt === hhmm(assignment.startsAt) && shift.endsAt === hhmm(assignment.endsAt))?.key ?? null;
}

/** Whether a broker works in a shift: their own shift, or the whole day (which covers both). */
export function worksInShift(assignmentKey: DutyShiftKey | null, shift: "manha" | "tarde") {
  return assignmentKey === shift || assignmentKey === "dia" || assignmentKey === null;
}

/**
 * The roster windows after the split moves (or is removed): a morning broker
 * keeps the morning, an afternoon broker the afternoon.
 */
export function retimeAssignmentForSplit(
  schedule: { startsAt: string; endsAt: string },
  previousSplit: string | null,
  nextSplit: string | null,
  assignment: { startsAt: string; endsAt: string },
): { startsAt: string; endsAt: string } | null {
  const start = hhmm(schedule.startsAt);
  const end = hhmm(schedule.endsAt);
  const current = { startsAt: hhmm(assignment.startsAt), endsAt: hhmm(assignment.endsAt) };
  const wasMorning = previousSplit && current.startsAt === start && current.endsAt === previousSplit;
  const wasAfternoon = previousSplit && current.startsAt === previousSplit && current.endsAt === end;
  if (!wasMorning && !wasAfternoon) return null;
  if (!nextSplit) return { startsAt: start, endsAt: end };
  return wasMorning ? { startsAt: start, endsAt: nextSplit } : { startsAt: nextSplit, endsAt: end };
}
