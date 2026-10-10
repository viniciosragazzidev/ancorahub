import { ChatHome, type HomeSummary } from "@/components/chat/chat-home";
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

/**
 * Broker home as a chat (2026-10-09 redesign): the assistants and the leads as
 * conversations, plus the day at a glance shown at the center on computers.
 */
export async function ChatHomeContent() {
  const [rail, data] = await Promise.all([getChatRailData(), getCachedBrokerWorkspaceData().catch(() => null)]);
  if (!rail || !data) return <LightDashboardUnavailable />;
  return (
    <ChatHome
      viewerName={rail.viewerName}
      assistants={rail.assistants}
      leads={rail.leads}
      nowIso={rail.nowIso}
      canQuote={rail.canQuote}
      summary={summaryOf(data)}
    />
  );
}
