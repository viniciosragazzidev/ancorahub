import { cronIntervalMs, JOB_SCHEDULE, type JobKey } from "./job-schedule";

/** Linhas `heartbeat:<job>` em system_settings (decisão do Vinicios, 27/10): os leitores de configuração pulam o prefixo. */
export const JOB_HEARTBEAT_PREFIX = "heartbeat:";

export type JobHeartbeatOutcome = "ok" | "erro";

export type JobHeartbeat = { job: JobKey; finishedAt: string; outcome: JobHeartbeatOutcome; durationMs: number };

/** Valor gravado: `<ISO do fim>|<ok|erro>|<duração em ms>`. Curto e legível no banco. */
export function formatJobHeartbeat(input: { finishedAt: Date; outcome: JobHeartbeatOutcome; durationMs: number }) {
  return `${input.finishedAt.toISOString()}|${input.outcome}|${Math.max(0, Math.round(input.durationMs))}`;
}

export function parseJobHeartbeat(job: JobKey, value: string | null | undefined): JobHeartbeat | null {
  if (!value) return null;
  const [finishedAt, outcome, duration] = value.split("|");
  if (!finishedAt || Number.isNaN(new Date(finishedAt).getTime())) return null;
  return {
    job,
    finishedAt: new Date(finishedAt).toISOString(),
    outcome: outcome === "erro" ? "erro" : "ok",
    durationMs: Number.isFinite(Number(duration)) ? Number(duration) : 0,
  };
}

/** Quantos ciclos sem rodar até o robô ser dado como parado (seção 3.4 do plano). */
export const STALLED_AFTER_CYCLES = 3;

/**
 * O robô está parado? Sem heartbeat nenhum ainda (deploy novo, ou o job nunca rodou desde a mudança) a resposta é
 * "desconhecido": a tela não acusa parada sem prova.
 */
export function jobHealth(job: JobKey, heartbeat: JobHeartbeat | null, now: Date): "ok" | "atrasado" | "desconhecido" {
  if (!heartbeat) return "desconhecido";
  const interval = cronIntervalMs(JOB_SCHEDULE[job].cron, now);
  const age = now.getTime() - new Date(heartbeat.finishedAt).getTime();
  return age > interval * STALLED_AFTER_CYCLES ? "atrasado" : "ok";
}
