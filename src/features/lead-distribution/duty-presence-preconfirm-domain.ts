export type PresenceOccurrenceCandidate = {
  assignmentId: string;
  dutyDate: string;
  startsAt: Date;
  endsAt: Date;
  status: string | null;
};

/** Only a unique, strictly contiguous next assignment can be pre-confirmed. */
export function selectContiguousNextPresenceOccurrence(input: {
  currentEndsAt: Date;
  candidates: readonly PresenceOccurrenceCandidate[];
  allowConfirmed?: boolean;
}) {
  const matches = input.candidates.filter((candidate) =>
    candidate.startsAt.getTime() === input.currentEndsAt.getTime()
    && (candidate.status === null || candidate.status === "pending" || (input.allowConfirmed && candidate.status === "confirmed")));
  return matches.length === 1 ? matches[0] : null;
}
