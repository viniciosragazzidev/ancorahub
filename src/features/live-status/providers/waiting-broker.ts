/**
 * Item 4 do plano: leads aguardando corretor (lead_distribution_jobs pendentes ou em nova tentativa), a próxima
 * tentativa e o motivo principal. Os retidos por regra (modo manual, antes do plantão, fila de frios...) são o
 * item 5 e ficam fora desta conta: eles só saem com atribuição manual ou na revisão de 15 min.
 */
import { isHeldDistributionReason } from "@/features/lead-distribution/domain";

import { clip } from "../copy";
import { alignToJobRun } from "../job-schedule";
import type { LiveStatus } from "../types";

export type WaitingJobGroup = { reason: string | null; total: number; nextRunAfter: Date | null };

export function buildWaitingBrokerStatus(input: { groups: readonly WaitingJobGroup[]; now: Date }): LiveStatus {
  const { now } = input;
  const groups = input.groups.filter((group) => !isHeldDistributionReason(group.reason));
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const held = input.groups.filter((group) => isHeldDistributionReason(group.reason)).reduce((sum, group) => sum + group.total, 0);
  const main = [...groups].sort((a, b) => b.total - a.total)[0] ?? null;
  const firstRun = groups.reduce<Date | null>((best, group) => (group.nextRunAfter && (!best || group.nextRunAfter < best) ? group.nextRunAfter : best), null);
  const withError = groups.some((group) => group.reason);
  return {
    id: "aguardando-corretor",
    label: "Aguardando corretor",
    value: total,
    emptyText: "Nenhum lead esperando corretor",
    severity: !total ? "ok" : withError ? "atencao" : "info",
    nextEvent: total && firstRun ? { at: alignToJobRun("distribution", firstRun, now).toISOString(), label: "Próxima tentativa" } : undefined,
    explanation: !total
      ? "O robô de distribuição tenta de novo a cada 2 min quando não acha corretor."
      : main?.reason
        ? `Motivo principal: ${clip(main.reason.replace(/\.$/, "").replace(/^./, (char) => char.toLowerCase()), 110)}.`
        : "Estão na fila para a próxima rodada do robô.",
    breakdown: held ? [{ label: "retidos por regra", value: held }] : undefined,
    action: { href: "/leads/distribuicao?view=operar", label: "Atribuir" },
    generatedAt: now.toISOString(),
  };
}
