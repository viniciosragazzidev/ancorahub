export type UnassignedLeadForArchive = {
  corretorId: string | null;
  deletedAt: Date | null;
  archivedAt: Date | null;
  distributionStatus: string;
  status: string;
  qualificationStatus: string | null;
};

const unassignedDistributionStatuses = new Set([
  "unassigned",
  "queued",
  "returned_to_queue",
]);

/**
 * The same operational boundary used by the distribution inbox and worker.
 * Keeping this deterministic makes the bulk archive guard easy to regression-test.
 */
export function isArchivableUnassignedLead(lead: UnassignedLeadForArchive) {
  return (
    !lead.corretorId &&
    !lead.deletedAt &&
    !lead.archivedAt &&
    unassignedDistributionStatuses.has(lead.distributionStatus) &&
    lead.status !== "lost" &&
    lead.qualificationStatus !== "disqualified"
  );
}

