export type UnassignedLeadForArchive = {
  corretorId: string | null;
  deletedAt: Date | null;
  archivedAt: Date | null;
};

/**
 * Archive is intentionally broader than the distribution worker: every lead
 * without a broker leaves the general list, including lost or disqualified
 * records. Archiving is a reversible visibility decision, not a routing action.
 */
export function isArchivableUnassignedLead(lead: UnassignedLeadForArchive) {
  return (
    !lead.corretorId &&
    !lead.deletedAt &&
    !lead.archivedAt
  );
}
