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

/** The numbers of the week in the sheet (zeros included: the broker sees what counts). */
function weekStats(data: BrokerHighlights) {
  const stats = data.stats;
  const offered = stats?.offered ?? 0;
  const accepted = stats?.accepted ?? 0;
  return [
    { label: "Ofertas recebidas", value: String(offered) },
    { label: "Ofertas aceitas", value: String(accepted) },
    { label: "Taxa de aceite", value: offered ? `${Math.round((accepted / offered) * 100)}%` : "sem ofertas" },
    { label: "Tempo para aceitar", value: formatDuration(stats?.medianAcceptSeconds ?? null) },
    { label: "Atendimentos iniciados", value: String(stats?.started ?? 0) },
    { label: "Tempo até iniciar", value: formatDuration(stats?.medianStartSeconds ?? null) },
  ];
}

/** One concrete way to climb, from the weakest number. */
function tipOf(data: BrokerHighlights) {
  const stats = data.stats;
  if (data.stepMission) return "registre a etapa dos leads aceitos: funil em dia conta para a gestão.";
  if (!stats || (!stats.offered && !stats.started)) return "fique disponível no plantão e aceite as ofertas assim que chegarem.";
  if (stats.offered && stats.accepted / stats.offered < 0.7) return "aceite mais ofertas: cada recusa ou oferta expirada derruba sua taxa.";
  if ((stats.medianAcceptSeconds ?? 0) > 60) return "aceite em até 1 minuto: quem responde primeiro sobe no aceite mais rápido.";
  if ((stats.medianStartSeconds ?? 0) > 15 * 60) return "chame o cliente logo depois de aceitar: o início rápido é o que mais converte.";
  return "continue assim: responder rápido e registrar cada atendimento mantém você no topo.";
}

function highlightsOf(data: BrokerHighlights | null): HomeHighlights | null {
  if (!data) return null;
  return {
    ranks: data.ranks.map((rank) => ({ key: rank.key, position: rank.position, label: RANK_LABEL[rank.key], total: rank.total })),
    acceptTime: data.stats?.medianAcceptSeconds !== null && data.stats?.medianAcceptSeconds !== undefined ? formatDuration(data.stats.medianAcceptSeconds) : null,
    stats: weekStats(data),
    tip: tipOf(data),
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
