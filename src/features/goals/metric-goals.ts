import type { TeamMetricWindow } from "@/features/team-management/metrics";

/**
 * Metas calculadas pela camada do G0 (sem consulta local): cotações, SLA e tempo de resposta.
 * Função pura: recebe a janela já calculada e devolve o valor atual e o percentual da meta.
 */

export const METRIC_GOAL_TYPES = ["quotes_count", "sla_rate", "response_minutes"] as const;
export type MetricGoalType = (typeof METRIC_GOAL_TYPES)[number];

export function isMetricGoalType(value: string): value is MetricGoalType {
  return (METRIC_GOAL_TYPES as readonly string[]).includes(value);
}

export type MetricGoalProgress = { current: number; percentage: number };

/**
 * quotes_count: cotações criadas (maior é melhor).
 * sla_rate: % de primeiro contato no prazo (maior é melhor).
 * response_minutes: tempo mediano para aceitar em minutos (menor é melhor; progresso = meta / valor atual).
 * Sem janela (corretor sem dado) o progresso é 0, nunca um valor inventado.
 */
export function metricGoalProgress(input: { targetType: MetricGoalType; targetValue: number; window: TeamMetricWindow | null }): MetricGoalProgress {
  const { targetType, targetValue, window } = input;
  if (!window || !(targetValue > 0)) return { current: 0, percentage: 0 };
  if (targetType === "quotes_count") {
    const current = window.quotes;
    return { current, percentage: clampPercent((current / targetValue) * 100) };
  }
  if (targetType === "sla_rate") {
    const current = window.slaRate;
    return { current, percentage: clampPercent((current / targetValue) * 100) };
  }
  const minutes = window.medianAcceptanceSeconds === null ? null : window.medianAcceptanceSeconds / 60;
  if (minutes === null || minutes <= 0) return { current: 0, percentage: 0 };
  return { current: Math.round(minutes * 10) / 10, percentage: clampPercent((targetValue / minutes) * 100) };
}

function clampPercent(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

/** Janela do G0 de quem a meta é: a equipe (scope team, scopeId = supervisor) ou o corretor (scope broker). */
export function windowForGoal(
  goal: { scope: string; scopeId: string | null },
  metrics: { teams: ReadonlyArray<{ supervisorId: string | null; current: TeamMetricWindow }>; brokers: ReadonlyArray<{ id: string; current: TeamMetricWindow }> },
): TeamMetricWindow | null {
  if (!goal.scopeId) return null;
  if (goal.scope === "team") return metrics.teams.find((team) => team.supervisorId === goal.scopeId)?.current ?? null;
  if (goal.scope === "broker") return metrics.brokers.find((broker) => broker.id === goal.scopeId)?.current ?? null;
  return null;
}
