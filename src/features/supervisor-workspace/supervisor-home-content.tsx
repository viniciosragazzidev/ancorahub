import { ChatHome, type HomeSummary } from "@/components/chat/chat-home";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { getCachedSupervisorWorkspaceData, getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";

import type { SupervisorWorkspaceData } from "./queries";

function summaryOf(data: SupervisorWorkspaceData): HomeSummary {
  return {
    receivedToday: data.today.receivedToday,
    acceptedToday: 0,
    inServiceNow: data.today.inService,
    slaAtRiskNow: data.today.late,
    duty: null,
    goal: null,
    // The team's day (the broker's labels do not fit a supervisor).
    stats: [
      { label: "Corretores na equipe", value: data.team.length },
      { label: "Leads recebidos hoje", value: data.today.receivedToday },
      { label: "Em atendimento", value: data.today.inService },
      { label: "Primeiro contato atrasado", value: data.today.late, alert: data.today.late > 0 },
    ],
  };
}

/** Supervisor Lite home (S2): the team assistants as conversations, the team's day at the center. */
export async function SupervisorHomeContent() {
  const [rail, data] = await Promise.all([getChatRailData(), getCachedSupervisorWorkspaceData().catch(() => null)]);
  if (!rail || !data) return <LightDashboardUnavailable />;
  return (
    <ChatHome
      viewerName={rail.viewerName}
      assistants={rail.assistants}
      leads={rail.leads}
      nowIso={rail.nowIso}
      canQuote={false}
      summary={summaryOf(data)}
    />
  );
}
