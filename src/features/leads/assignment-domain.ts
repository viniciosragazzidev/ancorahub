type RemovableLeadAssignment = {
  corretorId: string | null;
  status: string;
  distributionStatus: string;
  firstContactAt: Date | string | null;
  serviceStartedAt: Date | string | null;
  archivedAt: Date | string | null;
  deletedAt: Date | string | null;
};

export function canRemoveLeadAssignment(lead: RemovableLeadAssignment) {
  return Boolean(
    lead.corretorId &&
    lead.distributionStatus === "assigned" &&
    lead.status !== "converted" &&
    lead.status !== "lost" &&
    !lead.archivedAt &&
    !lead.deletedAt,
  );
}

/** Specific, user-facing reason a removal is blocked — null when it's allowed.
 * Kept separate from canRemoveLeadAssignment so that function's boolean
 * contract (and its tests) stay untouched. */
export function getLeadAssignmentBlockedReason(lead: RemovableLeadAssignment): string | null {
  if (!lead.corretorId) return "Este lead já não está atribuído a nenhum corretor — outra ação já removeu a atribuição.";
  if (lead.status === "converted") return "Este lead já foi convertido; a atribuição não pode ser removida.";
  if (lead.status === "lost") return "Este lead já foi perdido; a atribuição não pode ser removida.";
  if (lead.archivedAt) return "Este lead está arquivado; a atribuição não pode ser removida.";
  if (lead.deletedAt) return "Este lead foi excluído; a atribuição não pode ser removida.";
  if (lead.distributionStatus !== "assigned") return "A atribuição deste lead já foi alterada por outra ação. Atualize a página.";
  return null;
}
