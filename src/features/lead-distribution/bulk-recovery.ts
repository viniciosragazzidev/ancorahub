import { automaticDistributionHoldReason } from "./domain";

export type BulkDistributionCandidate = {
  id: string;
  status: string;
  distributionStatus: string;
  qualificationState: string | null;
  qualificationStatus: string | null;
};

const recoverableDistributionStatuses = new Set([
  "queued",
  "unassigned",
  "returned_to_queue",
]);

const terminalLeadStatuses = new Set(["converted", "lost"]);
/**
 * Keeps the bulk recovery action aligned with the automatic worker: only
 * operational leads that are ready for an offer may be re-enqueued.
 */
export function selectBulkDistributionCandidateIds(
  leads: BulkDistributionCandidate[],
) {
  return leads
    .filter((lead) => recoverableDistributionStatuses.has(lead.distributionStatus))
    .filter((lead) => !terminalLeadStatuses.has(lead.status))
    .filter((lead) => lead.qualificationState !== "IN_PROGRESS")
    .filter((lead) => lead.qualificationStatus !== "qualifying")
    .filter((lead) => !automaticDistributionHoldReason(lead.qualificationStatus, lead.qualificationState))
    .map((lead) => lead.id);
}
