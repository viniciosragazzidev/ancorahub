import type { TeamMetricBroker, TeamMetricTeam } from "./metrics";

/**
 * Insights em frase (G4). Função pura: compara a janela atual com a anterior do G0 e com os colegas da equipe.
 * Nenhuma métrica é recalculada: só se olha o que a camada já entregou.
 */

export type Insight = {
  id: string;
  subjectType: "broker" | "team";
  subjectId: string;
  tone: "positive" | "attention";
  message: string;
  /** Tamanho do movimento (para ordenar); maior aparece primeiro. */
  weight: number;
};

/** Mínimo de movimento para virar frase: evita ruído de uma ou duas ofertas. */
export const INSIGHT_THRESHOLDS = { acceptTimeDropPercent: 15, leadsRisePercent: 20, redistributionsPercentile: 0.9, slaRisePoints: 5 };

export const MAX_INSIGHTS_ON_SCREEN = 3;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Quem tem mais redistribuições que a maioria da equipe (percentil alto, não zero). */
function redistributionsAbove(broker: TeamMetricBroker, brokers: readonly TeamMetricBroker[], percentile: number): boolean {
  const others = brokers.filter((item) => item.id !== broker.id);
  if (others.length === 0 || broker.current.redistributions === 0) return false;
  const lower = others.filter((item) => item.current.redistributions < broker.current.redistributions).length;
  return lower / others.length >= percentile;
}

export function brokerInsights(input: { broker: TeamMetricBroker; brokers: readonly TeamMetricBroker[] }): Insight[] {
  const { broker, brokers } = input;
  const insights: Insight[] = [];
  const name = firstName(broker.name);

  const accept = changePercent(broker.current.medianAcceptanceSeconds, broker.previous.medianAcceptanceSeconds);
  if (accept !== null && accept <= -INSIGHT_THRESHOLDS.acceptTimeDropPercent) {
    const drop = Math.round(-accept);
    insights.push({ id: "accept_time_down", subjectType: "broker", subjectId: broker.id, tone: "positive", message: `${name} reduziu o tempo de aceite em ${drop}%.`, weight: drop });
  }
  if (redistributionsAbove(broker, brokers, INSIGHT_THRESHOLDS.redistributionsPercentile)) {
    insights.push({ id: "redistributions_top", subjectType: "broker", subjectId: broker.id, tone: "attention", message: `${name} tem mais redistribuições que ${Math.round(INSIGHT_THRESHOLDS.redistributionsPercentile * 100)}% da equipe.`, weight: broker.current.redistributions });
  }
  return insights;
}

export function teamInsights(input: { team: TeamMetricTeam; windowDays: 7 | 30 }): Insight[] {
  const { team, windowDays } = input;
  const insights: Insight[] = [];
  const previousLabel = windowDays === 7 ? "na semana anterior" : "nos 30 dias anteriores";

  const received = changePercent(team.current.received, team.previous.received);
  if (received !== null && received >= INSIGHT_THRESHOLDS.leadsRisePercent) {
    const rise = Math.round(received);
    insights.push({ id: "leads_up", subjectType: "team", subjectId: team.id, tone: "positive", message: `A equipe recebeu ${rise}% mais leads ${previousLabel}.`, weight: rise });
  }
  const slaDelta = team.current.slaRate - team.previous.slaRate;
  if (slaDelta >= INSIGHT_THRESHOLDS.slaRisePoints) {
    const points = Math.round(slaDelta);
    insights.push({ id: "sla_up", subjectType: "team", subjectId: team.id, tone: "positive", message: `O SLA da equipe subiu ${points} pontos ${previousLabel}.`, weight: points });
  }
  return insights;
}

/** No máximo três, os de maior movimento; de equipe e de corretor juntos. */
export function pickInsights(insights: readonly Insight[], limit = MAX_INSIGHTS_ON_SCREEN): Insight[] {
  return [...insights].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)).slice(0, limit);
}

