/**
 * A director may mark an assigned, not-yet-started lead as "Em atendimento" on
 * behalf of its broker. It runs the same start-service transaction, so the lead
 * is confirmed for that broker and leaves automatic redistribution.
 */
export function canDirectorMarkLeadInService(input: {
  role: string;
  corretorId: string | null;
  status: string;
  deletedAt?: Date | null;
  archivedAt?: Date | null;
}) {
  return input.role === "director"
    && Boolean(input.corretorId)
    && input.status === "distributed"
    && !input.deletedAt
    && !input.archivedAt;
}
