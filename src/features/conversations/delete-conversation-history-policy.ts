export type ConversationHistoryDeletionReason =
  | "feature_disabled"
  | "forbidden_role"
  | "linked_contact";

export function canDeleteConversationHistory(input: {
  role: string;
  featureEnabled: boolean;
  hasLead: boolean;
  hasClient: boolean;
  hasTeamMember: boolean;
}): { allowed: true } | { allowed: false; reason: ConversationHistoryDeletionReason } {
  if (!input.featureEnabled) return { allowed: false, reason: "feature_disabled" };
  if (input.role === "director") return { allowed: true };
  if (input.role !== "manager") {
    return { allowed: false, reason: "forbidden_role" };
  }
  if (input.hasLead || input.hasClient || input.hasTeamMember) {
    return { allowed: false, reason: "linked_contact" };
  }
  return { allowed: true };
}
