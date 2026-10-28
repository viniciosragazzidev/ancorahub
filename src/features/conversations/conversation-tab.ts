export type ConversationTab = "leads" | "distribuidos" | "corretores" | "coex";

/** Resolve a requested tab against the same server-derived access gates used by the page. */
export function resolveConversationTab(
  requestedTab: string | undefined,
  canSeeManagementTabs: boolean,
  hasCoexistenceChannel: boolean,
): ConversationTab {
  if (!canSeeManagementTabs) return "leads";
  if (requestedTab === "corretores") return "corretores";
  if (requestedTab === "distribuidos") return "distribuidos";
  if (requestedTab === "coex" && hasCoexistenceChannel) return "coex";
  return "leads";
}
