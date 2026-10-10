import { ChatHome, type HomeHighlights, type HomeSummary } from "@/components/chat/chat-home";
import { getBrokerHighlights, type BrokerHighlights } from "@/features/engagement/broker-stats";
import { formatDuration, RANK_LABEL } from "@/features/engagement/ranking";
import { shortName } from "@/features/ai-gateway/privacy";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { getCachedBrokerWorkspaceData, getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

const TIME_ZONE = "America/Sao_Paulo";
const time = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const day = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);

function summaryOf(data: BrokerWorkspaceData): HomeSummary {
  const active = data.duty?.active;
  const next = data.duty?.next;
  return {
    receivedToday: data.today.receivedToday,
    acceptedToday: data.today.acceptedToday,
    inServiceNow: data.today.inServiceNow,
    slaAtRiskNow: data.today.slaAtRiskNow,
    duty: active
      ? { title: `De plantão: ${active.scheduleName}`, detail: `${time(active.startsAt)} às ${time(active.endsAt)}${active.paused ? " · pausado" : ""}`, href: "/dashboard/c/plantao" }
      : next
        ? { title: `Próximo plantão: ${next.scheduleName}`, detail: `${day(next.startsAt)}, ${time(next.startsAt)} às ${time(next.endsAt)}`, href: "/dashboard/c/plantao" }
        : null,
    goal: data.goal,
  };
}

function highlightsOf(data: BrokerHighlights | null): HomeHighlights | null {
  if (!data) return null;
  return {
    ranks: data.ranks.map((rank) => ({ key: rank.key, position: rank.position, label: RANK_LABEL[rank.key], total: rank.total })),
    acceptTime: data.stats?.medianAcceptSeconds !== null && data.stats?.medianAcceptSeconds !== undefined ? formatDuration(data.stats.medianAcceptSeconds) : null,
    mission: data.stepMission
      ? {
        title: `Registre a etapa de ${shortName(data.stepMission.leadName)}`,
        detail: data.stepMission.remaining > 1 ? `${data.stepMission.remaining} leads ainda sem etapa. Assim seu funil fica certinho.` : "Último lead sem etapa. Assim seu funil fica certinho.",
        href: `/leads/${data.stepMission.leadId}`,
      }
      : null,
  };
}

/**
 * Broker home as a chat (2026-10-09 redesign): the assistants and the leads as
 * conversations, plus the day at a glance shown at the center on computers.
 */
export async function ChatHomeContent() {
  const [rail, data] = await Promise.all([getChatRailData(), getCachedBrokerWorkspaceData().catch(() => null)]);
  if (!rail || !data) return <LightDashboardUnavailable />;
  const highlights = await getBrokerHighlights(data.viewer.tenantId, data.viewer.userId).catch(() => null);
  return (
    <ChatHome
      viewerName={rail.viewerName}
      assistants={rail.assistants}
      leads={rail.leads}
      nowIso={rail.nowIso}
      canQuote={rail.canQuote}
      summary={summaryOf(data)}
      highlights={highlightsOf(highlights)}
    />
  );
}
