import "server-only";

import { sql } from "drizzle-orm";

import { TtlCache } from "@/shared/cache/ttl-cache";
import { getDatabase } from "@/shared/db";

import { formatJobHeartbeat, JOB_HEARTBEAT_PREFIX, parseJobHeartbeat, type JobHeartbeat, type JobHeartbeatOutcome } from "./heartbeat-format";
import { isJobKey, type JobKey } from "./job-schedule";

/**
 * Uma gravação por rodada de cada robô (decisão do Vinicios, 27/10): um upsert curto em system_settings, sem tabela
 * nova. Falha ao gravar nunca derruba a rodada: o robô fez o trabalho, só a tela fica sem saber.
 */
export async function recordJobHeartbeat(job: JobKey, outcome: JobHeartbeatOutcome, durationMs: number, finishedAt = new Date()) {
  const key = `${JOB_HEARTBEAT_PREFIX}${job}`;
  const value = formatJobHeartbeat({ finishedAt, outcome, durationMs });
  try {
    await getDatabase().execute(sql`
      insert into system_settings (key, value, updated_at)
      values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `);
  } catch (error) {
    console.warn("[job-heartbeat] write failed", { job, message: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
}

/** Os heartbeats mudam a cada minuto: 15 s de cache bastam e todas as telas dividem a mesma leitura. */
const heartbeatCache = new TtlCache<Map<JobKey, JobHeartbeat>>(15_000, 1);

export async function readJobHeartbeats(): Promise<Map<JobKey, JobHeartbeat>> {
  return heartbeatCache.getOrLoad("all", async () => {
    const rows = await getDatabase().execute(sql`
      select key, value from system_settings where key like ${`${JOB_HEARTBEAT_PREFIX}%`}
    `);
    const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{ key: string; value: string }>;
    const result = new Map<JobKey, JobHeartbeat>();
    for (const row of list) {
      const job = row.key.slice(JOB_HEARTBEAT_PREFIX.length);
      if (!isJobKey(job)) continue;
      const parsed = parseJobHeartbeat(job, row.value);
      if (parsed) result.set(job, parsed);
    }
    return result;
  });
}

/**
 * Envolve o handler de uma rota de robô: mede a rodada e grava o heartbeat no fim. Pedido sem a chave do cron
 * (401/403) não é rodada e não grava. Resposta 5xx ou exceção grava `erro`.
 * Fica dentro do `backgroundRoute`, então a gravação usa as conexões dos robôs, não as das telas.
 */
export function withJobHeartbeat<Args extends unknown[]>(job: JobKey, handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    const startedAt = Date.now();
    try {
      const response = await handler(...args);
      if (response.status !== 401 && response.status !== 403) {
        void recordJobHeartbeat(job, response.status >= 500 ? "erro" : "ok", Date.now() - startedAt);
      }
      return response;
    } catch (error) {
      void recordJobHeartbeat(job, "erro", Date.now() - startedAt);
      throw error;
    }
  };
}
