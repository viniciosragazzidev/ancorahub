import { brokerTeamAlerts, DEFAULT_ALERT_THRESHOLDS, teamAlerts, type OnDutyBroker, type TeamAlert } from "@/features/team-management/alerts";
import { teamHealthScore, type TeamHealthInput } from "@/features/team-management/health";
import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";
import { compareTrend, type TrendDirection } from "@/features/team-management/trend";

/** Visão da equipe (G2). Puro: recebe o que a camada do G0 entregou e monta a tela. Nenhuma métrica é recalculada aqui. */

export type TeamPageViewer = "gestor" | "supervisor";
export type HealthTone = "excelente" | "saudavel" | "atencao" | "critico";

export type TeamGoalView = { name: string; percentage: number; currentValue: string; targetValue: string };

export type TeamKpi = {
  key: string;
  label: string;
  value: string;
  /** Movimento favorável (vindo do G0 via compareTrend): up = melhorou, down = piorou. */
  trend: TrendDirection | null;
};

export type AttentionCard = {
  id: string;
  severity: TeamAlert["severity"];
  message: string;
  subjectType: TeamAlert["subjectType"];
  subjectId: string;
  links: Array<{ label: string; href: string }>;
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
  kpis: TeamKpi[];
  attention: AttentionCard[];
  load: { average: number; brokers: LoadBar[] };
  goal: TeamGoalView | null;
  managerBlock: ManagerBlock | null;
};

export type TeamPageInput = {
  team: TeamMetricTeam;
  /** Janela da unidade (só existe para o gestor). null quando o viewer é supervisor. */
  unitCurrent: TeamMetricWindow | null;
  now: Date;
  viewer: TeamPageViewer;
  goal: TeamGoalView | null;
  onDuty?: readonly OnDutyBroker[];
};

const BAND_MAP: Record<"Excelente" | "Saudável" | "Atenção" | "Crítico", HealthTone> = {
  Excelente: "excelente",
  Saudável: "saudavel",
  Atenção: "atencao",
  Crítico: "critico",
};

const SEVERITY_RANK: Record<TeamAlert["severity"], number> = { critical: 0, warning: 1, info: 2 };

/** Dias úteis (seg a sex, em UTC) depois do último movimento até agora. Dois ou mais = sem atividade recente. */
export function isInactiveForTwoBusinessDays(lastActivityAt: Date | null, now: Date): boolean {
  if (!lastActivityAt) return true;
  const lastDay = Date.UTC(lastActivityAt.getUTCFullYear(), lastActivityAt.getUTCMonth(), lastActivityAt.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let businessDays = 0;
  for (let day = lastDay + 86_400_000; day <= nowDay; day += 86_400_000) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays >= 2;
}

/** Entrada da função de saúde do G0, montada a partir das janelas já calculadas pela camada de métricas. */
export function teamHealthInputFor(team: TeamMetricTeam, unitCurrent: TeamMetricWindow | null, now: Date): TeamHealthInput {
  const current = team.current;
  const brokers = team.brokers;
  return {
    slaRate: current.slaRate,
    acceptanceRate: current.acceptanceRate,
    overdueReturns: current.overdueReturns ?? 0,
    leadsWithoutNextAction: current.leadsWithoutNextAction ?? 0,
    activeLeads: current.activeLeads ?? 0,
    conversionRate: current.conversion.rate,
    // O supervisor não recebe a janela da unidade: a própria conversão serve de referência neutra.
    unitAverageConversionRate: unitCurrent ? unitCurrent.conversion.rate : current.conversion.rate,
    redistributions: current.redistributions,
    offersReceived: current.received,
    activeBrokers: brokers.length,
    brokersActiveWithinTwoBusinessDays: brokers.filter((broker) => !isInactiveForTwoBusinessDays(broker.current.lastActivityAt, now)).length,
    brokerActiveLeads: brokers.map((broker) => broker.current.activeLeads ?? 0),
  };
}

/** Alertas em ordem de severidade: crítico, depois atenção, depois informação. Empate mantém a ordem do G0. */
export function sortAttentionAlerts(alerts: readonly TeamAlert[]): TeamAlert[] {
  return alerts
    .map((alert, index) => ({ alert, index }))
    .sort((a, b) => SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity] || a.index - b.index)
    .map((entry) => entry.alert);
}

function linksFor(alert: TeamAlert): AttentionCard["links"] {
  if (alert.subjectType === "broker") {
    return [
      { label: "Abrir corretor", href: `/equipe/${encodeURIComponent(alert.subjectId)}` },
      { label: "Cobrar", href: `/relacionamento?brokerId=${encodeURIComponent(alert.subjectId)}` },
    ];
  }
  return [{ label: "Mural da gestão", href: "/relacionamento" }];
}

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentText(value: number | null | undefined) {
  return value === null || value === undefined ? "Sem dado" : `${Math.round(value)}%`;
}

export function buildTeamPageView(input: TeamPageInput): TeamPageView {
  const { team, unitCurrent, now, viewer, goal } = input;
  const onDuty = input.onDuty ?? [];
  const brokers = team.brokers;
  const activeLeadsAverage = average(brokers.map((broker) => broker.current.activeLeads ?? 0));

  const health = teamHealthScore(teamHealthInputFor(team, unitCurrent, now));

  const brokerAlerts = brokers.flatMap((broker) => brokerTeamAlerts({
    broker,
    now,
    windowDays: 7,
    onDuty: onDuty.find((duty) => duty.id === broker.id) ?? null,
    teamAverageActiveLeads: activeLeadsAverage,
  }));
  const attention = sortAttentionAlerts([
    ...teamAlerts({ team, now, windowDays: 7, onDutyBrokers: onDuty }),
    ...brokerAlerts,
  ]).map((alert) => ({ id: `${alert.id}:${alert.subjectId}`, severity: alert.severity, message: alert.message, subjectType: alert.subjectType, subjectId: alert.subjectId, links: linksFor(alert) }));

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

  const managerBlock = viewer === "gestor" ? buildManagerBlock(brokers, now) : null;

  return {
    viewer,
    teamName: team.name,
    supervisorName: team.supervisorName ?? "Supervisor",
    brokersCount: brokers.length,
    health: {
      score: health.score,
      band: BAND_MAP[health.band],
      strongPoints: [...health.strongPoints],
      attentionPoints: [...health.attentionPoints],
    },
    kpis,
    attention,
    load: { average: activeLeadsAverage, brokers: loadBars },
    goal,
    managerBlock,
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

/** Estado vazio da tela: nada de alerta e nenhum corretor com pendência crítica. */
export function nobodyNeedsYou(view: TeamPageView): boolean {
  return view.attention.length === 0;
}
