/**
 * Canonical lead transition for a human handoff.
 *
 * The distribution worker only accepts finalized qualification states. Keeping
 * this transition in one place prevents a conversation from being visibly
 * handed off while it remains ineligible for automatic assignment.
 */
export function buildHumanHandoffLeadUpdate(at: Date) {
  return {
    qualificationStatus: "waiting_human" as const,
    qualificationState: "QUALIFIED" as const,
    qualificationCompletedAt: at,
    status: "new" as const,
    distributionStatus: "queued" as const,
    distributionUpdatedAt: at,
    updatedAt: at,
  };
}
