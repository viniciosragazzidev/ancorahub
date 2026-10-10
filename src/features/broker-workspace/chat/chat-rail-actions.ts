"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { isSupervisorLiteAvailable } from "../lite-audience";

import { getChatRailData, type ChatRailData } from "./chat-rail-data";

/**
 * The conversation list for the rail of the Lite on computers. Called by the
 * browser only on wide screens, so phones and the first byte of other screens
 * never pay for the workspace query.
 */
export async function loadChatRailAction(): Promise<ChatRailData | null> {
  const context = await getRequiredTenantContext();
  // Broker or supervisor with the supervisor Lite (the rail lists the team threads).
  if (context.role !== "broker" && !(await isSupervisorLiteAvailable(context))) return null;
  return getChatRailData();
}
