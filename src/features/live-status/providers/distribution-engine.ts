/**
 * Item 10 do plano: selo "Motor de distribuição ativo; última rodada há 40 s; próxima em 01:20".
 * Última rodada = heartbeat do robô `distribution`; próxima = cron (*\/2). Mais de 3 ciclos sem rodar vira crítico.
 * Falhas que pedem revisão: jobs de distribuição e efeitos pós-entrada em `failed` (os mesmos da aba Saúde).
 */
import { formatAgo } from "@/components/lite/status/format";

import { plural } from "../copy";
import { jobHealth, type JobHeartbeat } from "../heartbeat-format";
import { nextJobRunAt } from "../job-schedule";
import type { LiveScope, LiveSeal } from "../types";

export function buildDistributionEngineSeal(input: { heartbeat: JobHeartbeat | null; failedJobs: number; failedEffects: number; now: Date; scope: Pick<LiveScope, "role"> }): LiveSeal {
  const { heartbeat, now } = input;
  const health = jobHealth("distribution", heartbeat, now);
  const failed = input.failedJobs + input.failedEffects;
  const base = {
    id: "motor-distribuicao",
    lastRunAt: heartbeat?.finishedAt ?? null,
    nextRunAt: nextJobRunAt("distribution", now).toISOString(),
    action: { href: "/leads/distribuicao?view=saude_historico", label: "Ver saúde da distribuição" },
    generatedAt: now.toISOString(),
  };
  if (health === "atrasado") {
    const who = input.scope.role === "director" ? "Avise o Vinicios." : "Avise o diretor.";
    return {
      ...base,
      label: "Motor de distribuição parado",
      severity: "critico",
      detail: `O robô de distribuição não roda ${formatAgo(now.getTime() - new Date(heartbeat!.finishedAt).getTime())}. ${who}`,
    };
  }
  if (failed) {
    return {
      ...base,
      label: "Motor de distribuição ativo",
      severity: "atencao",
      detail: `${plural(failed, "lead falhou", "leads falharam")} nas tentativas e ${failed === 1 ? "pede" : "pedem"} revisão.`,
    };
  }
  if (heartbeat?.outcome === "erro") {
    return { ...base, label: "Motor de distribuição ativo", severity: "atencao", detail: "A última rodada terminou com erro; a próxima tenta de novo." };
  }
  return { ...base, label: "Motor de distribuição ativo", severity: health === "desconhecido" ? "info" : "ok" };
}
