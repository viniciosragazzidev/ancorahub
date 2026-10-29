/**
 * "Cliente voltou a chamar" (29/10): a lead that has been with the broker for a while writes again.
 * Pure rules, no I/O.
 */

/** How long after the distribution a new message counts as the client coming back. */
export const CLIENT_RETURNED_AFTER_HOURS = 24;
/** Messages looked at on each run (the reminders job runs every 5 min; the margin covers a failed run). */
export const CLIENT_RETURNED_LOOKBACK_MINUTES = 30;

export const INBOUND_DIRECTIONS = ["incoming", "inbound"] as const;

export type ClientReturnedCandidate = {
  leadId: string;
  brokerId: string | null;
  assignedAt: Date | null;
  messageAt: Date;
  alreadyNotified: boolean;
};

/** One notice per lead, ever, and only when the message came long enough after the distribution. */
export function shouldNotifyClientReturned(candidate: ClientReturnedCandidate, afterHours = CLIENT_RETURNED_AFTER_HOURS) {
  if (!candidate.brokerId || !candidate.assignedAt || candidate.alreadyNotified) return false;
  return candidate.messageAt.getTime() - candidate.assignedAt.getTime() >= afterHours * 60 * 60 * 1000;
}

/** "29/10" for the notice text (São Paulo day of the distribution). */
export function assignedDayLabel(assignedAt: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(assignedAt);
}

/** The audit row that marks the lead as already notified (the once per lead limit). */
export const CLIENT_RETURNED_AUDIT_ACTION = "lead.client_returned_notified";
