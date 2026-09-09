export type UnlinkedConversationDeletionReason =
  | "feature_disabled"
  | "forbidden_role"
  | "linked_contact";

export function canDeleteUnlinkedConversation(input: {
  role: string;
  featureEnabled: boolean;
  hasLead: boolean;
  hasClient: boolean;
  hasTeamMember: boolean;
}): { allowed: true } | { allowed: false; reason: UnlinkedConversationDeletionReason } {
  if (!input.featureEnabled) return { allowed: false, reason: "feature_disabled" };
  if (input.role !== "director" && input.role !== "manager") {
    return { allowed: false, reason: "forbidden_role" };
  }
  if (input.hasLead || input.hasClient || input.hasTeamMember) {
    return { allowed: false, reason: "linked_contact" };
  }
  return { allowed: true };
}
