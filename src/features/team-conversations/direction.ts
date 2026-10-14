import type { TenantContext } from "@/shared/auth/types";

/** Our side of the chat: the broker, the AI or the system (the providers spell it a few ways). */
export function isOutgoingDirection(direction: string) {
  return direction === "outbound" || direction === "outgoing" || direction === "output";
}

/** Only the Lite managers (their unit) and supervisors (their team) read other brokers' chats here. */
export function canReadTeamConversations(context: Pick<TenantContext, "role">) {
  return context.role === "manager" || context.role === "supervisor";
}
