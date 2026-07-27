export type ConversationIdentity = { displayName?: string; phone?: string; stableIdentifier?: string };
export type ResolveState = { status: "INITIALIZING" | "NO_CONVERSATION" | "UNIDENTIFIED" | "LOADING" | "FOUND" | "NOT_FOUND" | "FORBIDDEN" | "OFFLINE" | "ERROR" | "SESSION_EXPIRED"; message?: string; lead?: Record<string, unknown> };
