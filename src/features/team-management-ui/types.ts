/** Tipos locais da visão do gestor (G1). Espelham o plano; os números vêm da camada de métricas (G0) quando existir. */

export type HealthBand = "excelente" | "saudavel" | "atencao" | "critico";

export type KpiTrend = "up" | "flat" | "down" | null;

export type UnitKpi = {
  key: string;
  label: string;
  /** null = indicador ainda sem dado (antes do G0). */
  value: string | null;
  trend: KpiTrend;
  better: "up" | "down";
};

export type TeamHealthCard = {
  supervisorId: string;
  teamName: string;
  supervisorName: string;
  image: string | null;
  brokers: number;
  score: number | null;
  band: HealthBand | null;
  strengths: string[];
  concerns: string[];
};

export type SupervisorRow = {
  supervisorId: string;
  name: string;
  teamSize: number;
  sla: string | null;
  acceptRate: string | null;
  conversion: string | null;
  score: number | null;
  trend: KpiTrend;
};

export type UnassignedGroup = {
  brokers: number;
  names: string[];
};

export type UnitOverview = {
  kpis: UnitKpi[];
  teamsNeedingAttention: number;
  metricsAvailable: boolean;
  teams: TeamHealthCard[];
  supervisors: SupervisorRow[];
  unassigned: UnassignedGroup;
};
