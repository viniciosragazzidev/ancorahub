/**
 * Item 2 do plano: a fila Leads Frios só entrega o lead no dia em que ele completa 2 dias, às 9 h (São Paulo).
 * Regra pura em cold-age-release-rules.ts; aqui só se conta quem sai na próxima liberação.
 */
import { COLD_RELEASE_HOUR, coldReleaseCutoff } from "@/features/lead-distribution/cold-age-release-rules";

import type { LiveScope, LiveStatus } from "../types";

/** Leads esperando na fila, agrupados pelo dia de chegada (São Paulo). */
export type ColdReleaseQueue = {
  queueId: string;
  name: string;
  releasedEarlyToday: boolean;
  /** Um item por lead esperando (createdAt). Poucos por fila: a fila de frios esvazia todo dia. */
  waitingCreatedAt: readonly Date[];
};

const HOUR = 3_600_000;

/** Próximas 9 h em São Paulo, estritamente depois de agora. São Paulo não tem horário de verão desde 2019. */
export function nextColdReleaseAt(now: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const today = new Date(`${day}T${String(COLD_RELEASE_HOUR).padStart(2, "0")}:00:00-03:00`);
  return today.getTime() > now.getTime() ? today : new Date(today.getTime() + 24 * HOUR);
}

export function buildColdReleaseStatus(input: { queues: readonly ColdReleaseQueue[]; now: Date; scope: Pick<LiveScope, "role"> }): LiveStatus | null {
  const { queues, now } = input;
  if (!queues.length) return null;
  const nextRelease = nextColdReleaseAt(now);
  // Na próxima liberação, sai quem chegou antes do corte daquele instante.
  const nextCutoff = coldReleaseCutoff(nextRelease).getTime();
  let held = 0;
  let releasing = 0;
  for (const queue of queues) {
    const currentCutoff = coldReleaseCutoff(now, queue.releasedEarlyToday).getTime();
    for (const createdAt of queue.waitingCreatedAt) {
      if (createdAt.getTime() < currentCutoff) continue; // já liberado: a distribuição cuida
      held += 1;
      if (createdAt.getTime() < nextCutoff) releasing += 1;
    }
  }
  const name = queues.length === 1 ? queues[0].name : "Filas de leads frios";
  return {
    id: "fila-frios",
    label: name,
    value: releasing,
    emptyText: "Ninguém libera na próxima rodada",
    severity: releasing ? "info" : "ok",
    nextEvent: { at: nextRelease.toISOString(), label: releasing === 1 ? "Libera para corretores" : "Liberam para corretores", dueLabel: "Liberando agora" },
    explanation: "O lead frio só vai para corretor no dia em que completa 2 dias, às 9 h.",
    breakdown: held ? [{ label: "esperando liberação", value: held }] : undefined,
    action: input.scope.role === "director" ? { href: "/leads/distribuicao?view=filas", label: "Ver fila" } : undefined,
    generatedAt: now.toISOString(),
  };
}
