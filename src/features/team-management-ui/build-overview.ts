import { countTeamsNeedingAttention } from "./health-order";
import type { HealthBand, KpiTrend, SupervisorRow, TeamHealthCard, UnitKpi, UnitOverview } from "./types";

export type OverviewSupervisor = { supervisorId: string; name: string; image: string | null; teamName: string | null; brokers: number };

/** Números da camada de métricas (G0), por supervisor. Hoje a página não passa nenhum: fica null. */
export type TeamMetricsInput = {
  score: number | null;
  band: HealthBand | null;
  sla: string | null;
  acceptRate: string | null;
  conversion: string | null;
  trend: KpiTrend;
  strengths: string[];
  concerns: string[];
};

export type OverviewInput = {
  activeBrokers: number;
  supervisors: OverviewSupervisor[];
  unassigned: Array<{ userId: string; name: string }>;
  metrics: Map<string, TeamMetricsInput> | null;
};

/** Monta a visão da unidade a partir da identidade (equipes, supervisores, corretores) e das métricas, se houver. */
export function buildUnitOverview(input: OverviewInput): UnitOverview {
  const metricsFor = (supervisorId: string): TeamMetricsInput | undefined => input.metrics?.get(supervisorId);
  const metricsAvailable = [...(input.metrics?.values() ?? [])].some((metric) => metric.score !== null);

  const teams: TeamHealthCard[] = input.supervisors.map((supervisor) => {
    const metric = metricsFor(supervisor.supervisorId);
    return {
      supervisorId: supervisor.supervisorId,
      teamName: supervisor.teamName ?? `Equipe de ${supervisor.name}`,
      supervisorName: supervisor.name,
      image: supervisor.image,
      brokers: supervisor.brokers,
      score: metric?.score ?? null,
      band: metric?.band ?? null,
      strengths: metric?.strengths ?? [],
      concerns: metric?.concerns ?? [],
    };
  });

  const supervisors: SupervisorRow[] = input.supervisors.map((supervisor) => {
    const metric = metricsFor(supervisor.supervisorId);
    return {
      supervisorId: supervisor.supervisorId,
      name: supervisor.name,
      teamSize: supervisor.brokers,
      sla: metric?.sla ?? null,
      acceptRate: metric?.acceptRate ?? null,
      conversion: metric?.conversion ?? null,
      score: metric?.score ?? null,
      trend: metric?.trend ?? null,
    };
  });

  // Seis números do topo. Os que dependem de métrica ficam null ("Em breve") até o G0.
  const kpis: UnitKpi[] = [
    { key: "brokers", label: "Corretores ativos", value: String(input.activeBrokers), trend: null, better: "up" },
    { key: "teams", label: "Equipes", value: String(input.supervisors.length), trend: null, better: "up" },
    { key: "leads", label: "Leads da unidade", value: null, trend: null, better: "up" },
    { key: "sla", label: "SLA de primeiro contato", value: null, trend: null, better: "up" },
    { key: "accept", label: "Taxa de aceite", value: null, trend: null, better: "up" },
    { key: "conversion", label: "Conversão", value: null, trend: null, better: "up" },
  ];

  return {
    kpis,
    teamsNeedingAttention: countTeamsNeedingAttention(teams),
    metricsAvailable,
    teams,
    supervisors,
    unassigned: { brokers: input.unassigned.length, names: input.unassigned.map((broker) => broker.name) },
  };
}
