import "server-only";

import { cache } from "react";

import type { ThreadSummary } from "@/components/chat/types";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { buildSupervisorLeadThreads, buildSupervisorThreads } from "@/features/supervisor-workspace/chat";
import { getSupervisorWorkspaceData } from "@/features/supervisor-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { buildAssistantThreads, buildLeadThreads } from "./assistant-scripts";

/** One workspace load per request: the layout's rail and the Início page share it. */
export const getCachedBrokerWorkspaceData = cache(getBrokerWorkspaceData);

export type ChatRailData = {
  viewerName: string;
  assistants: ThreadSummary[];
  leads: ThreadSummary[];
  nowIso: string;
  canQuote: boolean;
};

/**
 * The conversation list of the broker app (assistants and leads), for the rail
 * that stays on the left of every Lite screen on computers. Null when the
 * workspace cannot load: the screens still work, only without the rail.
 */
/** One team load per request for the supervisor Lite (rail and Início share it). */
export const getCachedSupervisorWorkspaceData = cache(async () => getSupervisorWorkspaceData(await getRequiredTenantContext()));

export const getChatRailData = cache(async (): Promise<ChatRailData | null> => {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "supervisor") {
      const data = await getCachedSupervisorWorkspaceData();
      const now = new Date();
      return {
        viewerName: data.viewer.name,
        assistants: buildSupervisorThreads(data, now),
        leads: buildSupervisorLeadThreads(data, now),
        nowIso: now.toISOString(),
        canQuote: false,
      };
    }
    const data = await getCachedBrokerWorkspaceData();
    const dutyCalendar = (await getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).catch(() => "false")) === "true";
    const now = new Date();
    const capabilities = { quoteSimulator: true, dutyCalendar };
    return {
      viewerName: data.viewer.name,
      assistants: buildAssistantThreads({ data, capabilities, now }),
      leads: buildLeadThreads({ queue: data.queue, now }),
      nowIso: now.toISOString(),
      canQuote: capabilities.quoteSimulator,
    };
  } catch (error) {
    console.error("[chat-rail] Could not load the broker workspace", error);
    return null;
  }
});
