import { ChatHome } from "@/components/chat/chat-home";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { buildAssistantThreads, buildLeadThreads } from "@/features/broker-workspace/chat/assistant-scripts";
import { getBrokerWorkspaceData, type BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";

/**
 * Broker home as a chat (2026-10-09 redesign): the assistants and the leads as
 * conversations, built from the same workspace data the old home used.
 */
export async function ChatHomeContent() {
  let data: BrokerWorkspaceData;
  try {
    data = await getBrokerWorkspaceData();
  } catch (error) {
    console.error("[chat-home] Could not load the broker workspace", error);
    return <LightDashboardUnavailable />;
  }
  const dutyCalendar = (await getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).catch(() => "false")) === "true";
  const now = new Date();
  const capabilities = { quoteSimulator: true, dutyCalendar };
  return (
    <ChatHome
      viewerName={data.viewer.name}
      assistants={buildAssistantThreads({ data, capabilities, now })}
      leads={buildLeadThreads({ queue: data.queue, now })}
      nowIso={now.toISOString()}
      canQuote={capabilities.quoteSimulator}
    />
  );
}
