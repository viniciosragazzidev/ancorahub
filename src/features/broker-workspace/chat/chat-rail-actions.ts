"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { getChatRailData, type ChatRailData } from "./chat-rail-data";

/**
 * The conversation list for the rail of the Lite on computers. Called by the
 * browser only on wide screens, so phones and the first byte of other screens
 * never pay for the workspace query.
 */
export async function loadChatRailAction(): Promise<ChatRailData | null> {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return null;
  return getChatRailData();
}
