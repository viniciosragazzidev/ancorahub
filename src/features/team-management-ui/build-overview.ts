import { teamHealthScore, type TeamHealthBand } from "@/features/team-management/health";
import { teamHealthInputFor } from "@/features/team-management/health-input";
import type { TeamMetricTeam, TeamMetricsResult } from "@/features/team-management/metrics";
import { compareTrend } from "@/features/team-management/trend";
import type { WeeklySummaryValues } from "@/features/team-management/g6-pure";

import { countTeamsNeedingAttention } from "./health-order";
import type { HealthBand, KpiTrend, SupervisorRow, TeamHealthCard, UnitKpi, UnitOverview } from "./types";

export type OverviewSupervisor = { supervisorId: string; name: string; image: string | null; teamName: string | null; brokers: number };

export type TeamMetricsInput = TeamMetricTeam;

export type TeamMetricsOverviewInput = {
  unit: NonNullable<TeamMetricsResult["unit"]> | null;
  unitConversionRate: number | null;
  teamsBySupervisorId: ReadonlyMap<string, TeamMetricsInput>;
  unassignedTeam: TeamMetricsInput | null;
};

export type OverviewInput = {
  activeBrokers: number;
  supervisors: OverviewSupervisor[];
  unassigned: Array<{ userId: string; name: string }>;
  metrics: TeamMetricsOverviewInput | null;
  weeklySummary?: WeeklySummaryValues | null;
  now: Date;
};

const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const TEAM_HEALTH_BAND: Record<TeamHealthBand, HealthBand> = {
  Excelente: "excelente",
  Saudável: "saudavel",
  Atenção: "atencao",
  Crítico: "critico",
};

function asTeamHealth(
  input: TeamMetricsInput | null,
  unitConversionRate: number | null,
  now: Date,
) {
  if (!input) return null;
  const current = teamHealthScore(teamHealthInputFor(input, unitConversionRate, now));
  const previous = teamHealthScore(teamHealthInputFor({ ...input, current: input.previous }, unitConversionRate, now));
  return { current, previous };
}

function healthFields(
  metrics: TeamMetricsInput | null,
  unitConversionRate: number | null,
  now: Date,
) {
  const health = asTeamHealth(metrics, unitConversionRate, now);
  return {
    score: health?.current.score ?? null,
    band: health ? TEAM_HEALTH_BAND[health.current.band] : null,
    strengths: health ? [...health.current.strongPoints] : [],
    concerns: health ? [...health.current.attentionPoints] : [],
    trend: health ? compareTrend({ current: health.current.score, previous: health.previous.score, higherIsBetter: true }).direction : null,
  };
}

const kpiTrend = (current: number | null, previous: number | null, higherIsBetter = true): KpiTrend =>
  current === null || previous === null
    ? null
    : compareTrend({ current, previous, higherIsBetter }).direction;

const formatPercent = (value: number) => `${percentFormat.format(value)}%`;

/** Builds the unit page view from the active roster and one canonical G0 metrics result. */
export function buildUnitOverview(input: OverviewInput): UnitOverview {
  const unit = input.metrics?.unit ?? null;
  const unitConversionRate = input.metrics?.unitConversionRate ?? null;
  const metricFor = (supervisorId: string) => input.metrics?.teamsBySupervisorId.get(supervisorId) ?? null;

  const teams: TeamHealthCard[] = input.supervisors.map((supervisor) => {
    const metrics = metricFor(supervisor.supervisorId);
    const health = healthFields(metrics, unitConversionRate, input.now);
    return {
      id: supervisor.supervisorId,
      supervisorId: supervisor.supervisorId,
      teamName: supervisor.teamName ?? `Equipe de ${supervisor.name}`,
      supervisorName: supervisor.name,
      image: supervisor.image,
      brokers: supervisor.brokers,
      score: health.score,
      band: health.band,
      strengths: health.strengths,
      concerns: health.concerns,
      trend: health.trend,
      isUnassigned: false,
      brokerNames: [],
    };
  });

  const unassignedHealth = healthFields(input.metrics?.unassignedTeam ?? null, unitConversionRate, input.now);
  if (input.unassigned.length > 0) {
    teams.push({
      id: "__no_team__",
      supervisorId: "__no_team__",
      teamName: "Sem equipe",
      supervisorName: "Sem supervisor",
      image: null,
      brokers: input.unassigned.length,
      score: unassignedHealth.score,
      band: unassignedHealth.band,
      strengths: unassignedHealth.strengths,
      concerns: unassignedHealth.concerns,
      trend: unassignedHealth.trend,
      isUnassigned: true,
      brokerNames: input.unassigned.map((broker) => broker.name),
    });
  }

  const supervisors: SupervisorRow[] = input.supervisors.map((supervisor) => {
    const metrics = metricFor(supervisor.supervisorId);
    const health = healthFields(metrics, unitConversionRate, input.now);
    return {
      supervisorId: supervisor.supervisorId,
      name: supervisor.name,
      teamSize: supervisor.brokers,
      sla: metrics ? formatPercent(metrics.current.slaRate) : null,
      acceptRate: metrics ? formatPercent(metrics.current.acceptanceRate) : null,
      conversion: metrics ? formatPercent(metrics.current.conversion.rate) : null,
      score: health.score,
      trend: health.trend,
    };
  });

  const kpis: UnitKpi[] = [
    { key: "brokers", label: "Corretores ativos", value: numberFormat.format(input.activeBrokers), trend: null, better: "up" },
    { key: "teams", label: "Equipes", value: numberFormat.format(input.supervisors.length), trend: null, better: "up" },
    {
      key: "leads",
      label: "Leads da unidade",
      value: unit ? numberFormat.format(unit.current.conversion.received) : null,
      trend: unit ? kpiTrend(unit.current.conversion.received, unit.previous.conversion.received) : null,
      better: "up",
    },
    {
      key: "sla",
      label: "SLA de primeiro contato",
      value: unit ? formatPercent(unit.current.slaRate) : null,
      trend: unit ? kpiTrend(unit.current.slaRate, unit.previous.slaRate) : null,
      better: "up",
    },
    {
      key: "accept",
      label: "Taxa de aceite",
      value: unit ? formatPercent(unit.current.acceptanceRate) : null,
      trend: unit ? kpiTrend(unit.current.acceptanceRate, unit.previous.acceptanceRate) : null,
      better: "up",
    },
    {
      key: "conversion",
      label: "Conversão",
      value: unit ? formatPercent(unit.current.conversion.rate) : null,
      trend: unit ? kpiTrend(unit.current.conversion.rate, unit.previous.conversion.rate) : null,
      better: "up",
    },
  ];

  const metricsAvailable = unit !== null;
  return {
    kpis,
    teamsNeedingAttention: countTeamsNeedingAttention(teams.filter((team) => !team.isUnassigned)),
    unassignedNeedsAttention: unassignedHealth.band === "atencao" || unassignedHealth.band === "critico",
    metricsAvailable,
    teams,
    supervisors,
    unassigned: { brokers: input.unassigned.length, names: input.unassigned.map((broker) => broker.name) },
    weeklySummary: input.weeklySummary ?? null,
  };
}
