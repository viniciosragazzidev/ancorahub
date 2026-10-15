import { brokerTeamAlerts, DEFAULT_ALERT_THRESHOLDS, teamAlerts, type OnDutyBroker, type TeamAlert } from "@/features/team-management/alerts";
import type { CriticalLead } from "@/features/team-management/alert-context";
import { teamHealthScore } from "@/features/team-management/health";
import { isInactiveForTwoBusinessDays, teamHealthInputFor } from "@/features/team-management/health-input";
import type { TeamMetricBroker, TeamMetricTeam } from "@/features/team-management/metrics";
import { compareTrend, type TrendDirection } from "@/features/team-management/trend";

/** Visão da equipe (G2). Puro: monta a tela a partir do que o G0 entregou. Nenhuma métrica é recalculada aqui. */

export type TeamPageViewer = "gestor" | "supervisor";
export type HealthTone = "excelente" | "saudavel" | "atencao" | "critico";
export type AlertSeverity = TeamAlert["severity"];

export type TeamGoalView = { name: string; percentage: number; currentValue: string; targetValue: string };

export type TeamKpi = {
  key: string;
  label: string;
  value: string;
  /** Movimento favorável (compareTrend do G0): up = melhorou, down = piorou. */
  trend: TrendDirection | null;
};

/** Um card por corretor: o alerta mais grave em frase, os outros como etiqueta, e o lead mais crítico. */
export type BrokerAttention = {
  brokerId: string;
  name: string;
  image: string | null;
  severity: AlertSeverity;
  message: string;
  badges: Array<{ id: string; label: string }>;
  lead: CriticalLead | null;
};

export type LoadBar = { id: string; name: string; activeLeads: number; overThreshold: boolean };

/** Bloco extra do gestor: a gestão do supervisor, corretor por corretor. */
export type ManagerBlock = {
  belowAverage: string[];
  evolving: string[];
  noActivity: string[];
  criticalPending: string[];
};

export type TeamPageView = {
  viewer: TeamPageViewer;
  teamName: string;
  supervisorName: string;
  brokersCount: number;
  health: { score: number; band: HealthTone; strongPoints: string[]; attentionPoints: string[] };
  /** Uma linha só, no cabeçalho: o alerta de equipe mais grave que não repete um card de corretor. */
  teamSummary: string | null;
  kpis: TeamKpi[];
  attention: BrokerAttention[];
  load: { average: number; brokers: LoadBar[] };
  goal: TeamGoalView | null;
  managerBlock: ManagerBlock | null;
};

export type TeamPageInput = {
  team: TeamMetricTeam;
  /** Conversão agregada da unidade (G0). */
  unitConversionRate: number | null;
  now: Date;
  viewer: TeamPageViewer;
  goal: TeamGoalView | null;
  onDuty?: readonly OnDutyBroker[];
  criticalLeads?: ReadonlyMap<string, CriticalLead>;
};

const BAND_MAP: Record<"Excelente" | "Saudável" | "Atenção" | "Crítico", HealthTone> = {
  Excelente: "excelente",
  Saudável: "saudavel",
  Atenção: "atencao",
  Crítico: "critico",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Rótulos curtos das etiquetas de corretor. */
const BADGE_LABEL: Record<TeamAlert["id"], string> = {
  no_accept_in_duty: "Sem aceite no plantão",
  redistributions_rising: "Redistribuições em alta",
  many_without_next_action: "Sem próxima ação",
  conversion_falling: "Conversão caiu",
  overloaded: "Carga alta",
  few_leads: "Poucos leads",
  team_sla_worsening: "SLA caiu",
  critical_pending: "Retornos urgentes",
};

/** Alertas de equipe que apenas repetem os individuais: não viram linha de resumo. */
const TEAM_DUPLICATES_OF_BROKER_CARDS: ReadonlySet<TeamAlert["id"]> = new Set(["overloaded", "few_leads"]);

/** Tira o prefixo "Destaque:" / "Ponto de atenção:" das frases da saúde: o título da seção já diz o tipo. */
export function plainHealthPoint(text: string): string {
  const stripped = text.replace(/^(Destaque|Ponto de atenção|Ponto de atencao):\s*/i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Alertas em ordem de severidade: crítico, depois atenção, depois informação. Empate mantém a ordem do G0. */
export function sortAttentionAlerts(alerts: readonly TeamAlert[]): TeamAlert[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity] || a.index - b.index)
    .map((entry) => entry.alert);
}

/** Um card por corretor, na ordem do alerta mais grave de cada um. */
export function groupAttentionByBroker(alerts: readonly TeamAlert[], brokers: readonly TeamMetricBroker[], criticalLeads: ReadonlyMap<string, CriticalLead>): BrokerAttention[] {
  const sorted = sortAttentionAlerts(alerts.filter((alert) => alert.subjectType === "broker"));
  const byBroker = new Map<string, TeamAlert[]>();
  for (const alert of sorted) {
    const list = byBroker.get(alert.subjectId) ?? [];
    list.push(alert);
    byBroker.set(alert.subjectId, list);
  }
  return [...byBroker.entries()].map(([brokerId, list]) => {
    const broker = brokers.find((item) => item.id === brokerId);
    const [top, ...others] = list;
    return {
      brokerId,
      name: broker?.name ?? "Corretor",
      image: broker?.image ?? null,
      severity: top!.severity,
      message: top!.message,
      badges: others.map((alert) => ({ id: alert.id, label: BADGE_LABEL[alert.id] })),
      lead: criticalLeads.get(brokerId) ?? null,
    };
  });
}

/** O alerta de equipe mais grave que não repete um card de corretor. */
export function pickTeamSummary(alerts: readonly TeamAlert[]): string | null {
  const teamOnly = sortAttentionAlerts(alerts.filter((alert) => alert.subjectType === "team" && !TEAM_DUPLICATES_OF_BROKER_CARDS.has(alert.id)));
  return teamOnly[0]?.message ?? null;
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentText(value: number | null | undefined) {
  return value === null || value === undefined ? "Sem dado" : `${Math.round(value)}%`;
}

export function buildTeamPageView(input: TeamPageInput): TeamPageView {
  const { team, now, viewer, goal } = input;
  const onDuty = input.onDuty ?? [];
  const criticalLeads = input.criticalLeads ?? new Map<string, CriticalLead>();
  const brokers = team.brokers;
  const activeLeadsAverage = average(brokers.map((broker) => broker.current.activeLeads ?? 0));

  const health = teamHealthScore(teamHealthInputFor(team, input.unitConversionRate, now));

  const brokerAlerts = brokers.flatMap((broker) => brokerTeamAlerts({
    broker,
    now,
    windowDays: 7,
    onDuty: onDuty.find((duty) => duty.id === broker.id) ?? null,
    teamAverageActiveLeads: activeLeadsAverage,
  }));
  const allAlerts = [...teamAlerts({ team, now, windowDays: 7, onDutyBrokers: onDuty }), ...brokerAlerts];

  const current = team.current;
  const previous = team.previous;
  const kpis: TeamKpi[] = [
    { key: "sla", label: "SLA de primeiro contato", value: percentText(current.slaRate), trend: compareTrend({ current: current.slaRate, previous: previous.slaRate, higherIsBetter: true }).direction },
    { key: "accept", label: "Taxa de aceite", value: percentText(current.acceptanceRate), trend: compareTrend({ current: current.acceptanceRate, previous: previous.acceptanceRate, higherIsBetter: true }).direction },
    { key: "conversion", label: "Conversão", value: percentText(current.conversion.rate), trend: compareTrend({ current: current.conversion.rate, previous: previous.conversion.rate, higherIsBetter: true }).direction },
    { key: "active", label: "Leads ativos", value: String(current.activeLeads ?? 0), trend: null },
    { key: "redistributions", label: "Redistribuições", value: String(current.redistributions), trend: compareTrend({ current: current.redistributions, previous: previous.redistributions, higherIsBetter: false }).direction },
    { key: "overdue", label: "Retornos vencidos", value: String(current.overdueReturns ?? 0), trend: compareTrend({ current: current.overdueReturns ?? 0, previous: previous.overdueReturns ?? 0, higherIsBetter: false }).direction },
  ];

  const loadBars: LoadBar[] = brokers.map((broker) => {
    const activeLeads = broker.current.activeLeads ?? 0;
    return {
      id: broker.id,
      name: broker.name,
      activeLeads,
      overThreshold: activeLeadsAverage > 0 && activeLeads > activeLeadsAverage * (1 + DEFAULT_ALERT_THRESHOLDS.loadDifference),
    };
  });

  return {
    viewer,
    teamName: team.name,
    supervisorName: team.supervisorName ?? "Supervisor",
    brokersCount: brokers.length,
    health: {
      score: health.score,
      band: BAND_MAP[health.band],
      strongPoints: health.strongPoints.map(plainHealthPoint),
      attentionPoints: health.attentionPoints.map(plainHealthPoint),
    },
    teamSummary: pickTeamSummary(allAlerts),
    kpis,
    attention: groupAttentionByBroker(allAlerts, brokers, criticalLeads),
    load: { average: activeLeadsAverage, brokers: loadBars },
    goal,
    managerBlock: viewer === "gestor" ? buildManagerBlock(brokers, now) : null,
  };
}

/** Gestão do supervisor, por corretor: abaixo da média de aceite, evoluindo, sem atividade e com pendências críticas. */
export function buildManagerBlock(brokers: readonly TeamMetricBroker[], now: Date): ManagerBlock {
  const acceptAverage = average(brokers.filter((broker) => broker.current.received > 0).map((broker) => broker.current.acceptanceRate));
  return {
    belowAverage: brokers
      .filter((broker) => broker.current.received > 0 && broker.current.acceptanceRate < acceptAverage)
      .map((broker) => broker.name),
    evolving: brokers
      .filter((broker) => compareTrend({ current: broker.current.conversion.rate, previous: broker.previous.conversion.rate, higherIsBetter: true }).direction === "up")
      .map((broker) => broker.name),
    noActivity: brokers
      .filter((broker) => isInactiveForTwoBusinessDays(broker.current.lastActivityAt, now))
      .map((broker) => broker.name),
    criticalPending: brokers
      .filter((broker) => (broker.current.criticalOverdueReturns ?? 0) > 0)
      .map((broker) => broker.name),
  };
}

/** Estado vazio da tela: nenhum card de corretor e nenhum alerta de equipe para mostrar. */
export function nobodyNeedsYou(view: TeamPageView): boolean {
  return view.attention.length === 0 && view.teamSummary === null;
}
