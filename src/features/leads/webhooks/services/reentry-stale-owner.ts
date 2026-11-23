/**
 * A contact who sends a new form while their broker left the lead stalled
 * (no progress for longer than the company's "lead parado" days) goes back to
 * the queue and is distributed again, instead of staying with that broker.
 */
export type ReentryOwnerState = {
  corretorId: string | null;
  status: string | null;
  stageEnteredAt: Date | null;
  assignedAt: Date | null;
};

const CLOSED_STATUSES = new Set(["converted", "lost"]);

export function parseStagnantDays(value: string | null | undefined): number {
  return Math.max(1, Number.parseInt(value ?? "", 10) || 3);
}

export function isStaleOwnerOnReentry(lead: ReentryOwnerState, now: Date, stagnantDays: number): boolean {
  if (!lead.corretorId) return false;
  if (CLOSED_STATUSES.has(lead.status ?? "")) return false;
  const since = lead.stageEnteredAt ?? lead.assignedAt;
  if (!since) return false;
  return now.getTime() - since.getTime() > stagnantDays * 24 * 60 * 60 * 1000;
}
