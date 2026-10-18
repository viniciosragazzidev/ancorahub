import { ChatHome, type HomeHighlights, type HomeSummary } from "@/components/chat/chat-home";
import { nextActionOf } from "@/features/assist/next-action";
import { getFirstSteps } from "@/features/assist/first-steps";
import { getBrokerHighlights, type BrokerHighlights } from "@/features/engagement/broker-stats";
import { formatDuration, RANK_LABEL } from "@/features/engagement/ranking";
import { shortName } from "@/features/ai-gateway/privacy";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { getCachedBrokerWorkspaceData, getCachedBrokerJourneyData, getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { presenceAskOf } from "@/features/broker-workspace/chat/assistant-scripts";
import { buildBrokerNowItems } from "@/features/broker-workspace/now-items";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import type { BrokerJourneyData } from "@/features/engagement/journey-types";

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
      ? { title: `De plantão: ${active.scheduleName}`, detail: `${time(active.startsAt)} às ${time(active.endsAt)}${active.paused ? " · pausado" : ""}`, href: "/plantoes/agora" }
      : next
        ? { title: `Próximo plantão: ${next.scheduleName}`, detail: `${day(next.startsAt)}, ${time(next.startsAt)} às ${time(next.endsAt)}`, href: "/plantoes/agora" }
        : null,
    goal: data.goal,
    now: {
      title: "Agora",
      emptyText: "Sem aceite, resposta ou retorno vencido. Você está em dia.",
      items: buildBrokerNowItems({ pendingOffers: data.pendingOffers, priorities: data.priorities, agenda: data.agenda, now: data.updatedAt }),
    },
  };
}

/** A plantão waiting for the broker's confirmation comes first: without it no lead arrives. */
function presenceNext(data: BrokerWorkspaceData): HomeSummary["next"] {
  const presence = data.duty?.presence;
  if (presence?.status !== "pending") return null;
  return {
    label: presence.mode === "presencial" ? "Tirar a foto do plantão" : "Confirmar presença",
    detail: presence.mode === "presencial" ? `O ${presence.scheduleName} é presencial: esteja na unidade, tire a foto do local e o diretor libera você.` : `Confirme o ${presence.scheduleName} para começar a receber leads.`,
    href: "/plantoes/agora",
    urgent: true,
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

function highlightsOf(data: BrokerHighlights | null, journey: BrokerJourneyData | null): HomeHighlights | null {
  const step = journey?.missions.find((m) => m.metric === "steps.coverage" && m.progress.eligible);
  if (!data && !step) return null;
  return {
    ranks: data?.ranks.map((rank) => ({ key: rank.key, position: rank.position, label: RANK_LABEL[rank.key], total: rank.total })) ?? [],
    acceptTime: data?.stats?.medianAcceptSeconds !== null && data?.stats?.medianAcceptSeconds !== undefined ? formatDuration(data.stats.medianAcceptSeconds) : null,
    stats: data ? weekStats(data) : [],
    tip: data ? tipOf(data) : null,
    mission: step
      ? {
        title: step.progress.remaining ? data?.stepMission ? `Registre a etapa de ${shortName(data.stepMission.leadName)}` : "Registre as etapas dos leads" : "Etapas do dia em dia",
        detail: `${step.progress.progress} de ${step.progress.target} leads com etapa. Bônus de ${step.bonusPoints} pts ao fechar o dia.`,
        href: step.progress.remaining ? data?.stepMission ? `/leads/${data.stepMission.leadId}` : "/minha-fila" : "/jornada",
        progress: step.progress,
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
  const [highlights, journey, firstSteps] = await Promise.all([
    getBrokerHighlights(data.viewer.tenantId, data.viewer.userId).catch(() => null),
    getCachedBrokerJourneyData(data.viewer.tenantId, data.viewer.userId).catch(() => null),
    getFirstSteps(data.viewer.tenantId, data.viewer.userId).catch(() => null),
  ]);
  return (
    <ChatHome
      viewerName={rail.viewerName}
      assistants={rail.assistants}
      leads={rail.leads}
      nowIso={rail.nowIso}
      canQuote={rail.canQuote}
      summary={{ ...summaryOf(data), next: presenceNext(data) ?? nextActionOf(data.nextAction, journey) }}
      presence={presenceAskOf(data)}
      firstSteps={firstSteps}
      highlights={highlightsOf(highlights, journey)}
    />
  );
}
