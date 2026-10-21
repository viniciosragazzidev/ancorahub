import { ChatHome, type HomeSummary } from "@/components/chat/chat-home";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { getCachedSupervisorWorkspaceData, getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { loadNeedsYouIfEnabled, type NeedsYouSummary } from "@/features/team-management-extras/needs-you-summary";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getBrokerWhatsAppStatusForContext } from "@/features/dashboard/today";
import { buildSupervisorNowItems } from "./now-items";

import type { SupervisorWorkspaceData } from "./queries";

function summaryOf(data: SupervisorWorkspaceData): HomeSummary {
  return {
    receivedToday: data.today.receivedToday,
    acceptedToday: 0,
    inServiceNow: data.today.inService,
    slaAtRiskNow: data.today.late,
    duty: null,
    goal: data.goal,
    now: {
      title: "Acontecendo agora",
      emptyText: "Sem leads chegando ou atrasados. Confira a escala de hoje quando quiser.",
      items: buildSupervisorNowItems(data, data.updatedAt),
    },
    // The team's day (the broker's labels do not fit a supervisor).
    stats: [
      { label: "Corretores na equipe", value: data.team.length },
      { label: "Leads recebidos hoje", value: data.today.receivedToday },
      { label: "Em atendimento", value: data.today.inService },
      { label: "Primeiro contato atrasado", value: data.today.late, alert: data.today.late > 0 },
    ],
  };
}

/** Com a gestão de equipes ligada, a pílula de próxima ação vira "Precisa de você" (G4). */
function withNeeds(summary: HomeSummary, needs: NeedsYouSummary | null): HomeSummary {
  if (!needs) return summary;
  return { ...summary, next: { label: needs.phrase, detail: "Abrir a equipe e ver quem precisa de você.", href: needs.href, urgent: needs.urgent } };
}

/** Supervisor Lite home (S2): the team assistants as conversations, the team's day at the center. */
export async function SupervisorHomeContent() {
  const context = await getRequiredTenantContext();
  const [rail, data, needs, whatsapp] = await Promise.all([
    getChatRailData(),
    getCachedSupervisorWorkspaceData().catch(() => null),
    loadNeedsYouIfEnabled(context),
    getBrokerWhatsAppStatusForContext(context).catch(() => null),
  ]);
  if (!rail || !data) return <LightDashboardUnavailable />;
  return (
    <ChatHome
      viewerName={rail.viewerName}
      assistants={rail.assistants}
      leads={rail.leads}
      nowIso={rail.nowIso}
      canQuote={false}
      whatsappActivity={whatsapp?.activity}
      summary={withNeeds(summaryOf(data), needs)}
    />
  );
}
