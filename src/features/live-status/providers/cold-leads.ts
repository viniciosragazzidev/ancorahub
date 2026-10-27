/**
 * Item 1 do plano: leads frios sem corretor e a próxima requalificação automática.
 * A regra é a do requalificador (cold-lead-requalification-policy.ts): uma tentativa 3 h depois de esfriar, só para
 * quem esfriou nas últimas 24 h, enviada entre 8 h e 20 h. Com a régua turbo cobrindo, quem manda é a régua.
 */
import {
  AUTOMATIC_COLD_LEAD_REQUALIFICATION,
  AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS,
  nextRequalificationBusinessWindowAt,
} from "@/features/ai-qualification/cold-lead-requalification-policy";

import { alignToJobRun } from "../job-schedule";
import type { LiveScope, LiveStatus } from "../types";

export type ColdLeadRow = { coldSince: Date; attempts: number };

const HOUR = 3_600_000;

export function buildColdLeadsStatus(input: {
  rows: readonly ColdLeadRow[];
  now: Date;
  scope: Pick<LiveScope, "role">;
  automaticEnabled: boolean;
  turboCovers: boolean;
}): LiveStatus {
  const { rows, now } = input;
  const interval = AUTOMATIC_COLD_LEAD_REQUALIFICATION.intervalMinutes * 60_000;
  const lookback = AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS * HOUR;
  const attempted = rows.filter((row) => row.attempts > 0).length;
  const eligible = rows.filter((row) => row.attempts === 0 && now.getTime() - row.coldSince.getTime() <= lookback);
  const outside = rows.length - attempted - eligible.length;
  const firstDue = eligible.reduce<ColdLeadRow | null>((best, row) => (!best || row.coldSince < best.coldSince ? row : best), null);

  const status: LiveStatus = {
    id: "frios",
    label: "Leads frios",
    value: rows.length,
    emptyText: "Nenhum lead frio agora",
    severity: rows.length ? "info" : "ok",
    explanation: rows.length
      ? `${attempted === 1 ? "1 já recebeu" : `${attempted} já receberam`} a tentativa; ${eligible.length === 1 ? "1 espera" : `${eligible.length} esperam`} completar 3 h frio.`
      : "Lead que esfria sem corretor aparece aqui e recebe uma tentativa automática depois de 3 h.",
    breakdown: rows.length
      ? [
          { label: "já tentados", value: attempted },
          { label: "esperando as 3 h", value: eligible.length },
          ...(outside > 0 ? [{ label: "fora das 24 h", value: outside }] : []),
        ]
      : undefined,
    action: input.scope.role === "director"
      ? { href: "/leads/distribuicao?view=filas", label: "Revisar" }
      : { href: "/leads/distribuicao?view=operar", label: "Ver fila" },
    generatedAt: now.toISOString(),
  };
  if (!rows.length) return status;
  if (!input.automaticEnabled) return { ...status, note: "Requalificação automática desligada." };
  if (input.turboCovers) return { ...status, note: "A régua de lembretes cuida destes leads; a requalificação de 3 h fica parada." };
  if (!firstDue) return { ...status, note: "Nenhum lead na janela da tentativa automática." };
  const dueAt = new Date(firstDue.coldSince.getTime() + interval);
  // O envio sai no passo do robô e só entre 8 h e 20 h (São Paulo); fora disso, às 8 h.
  const runAt = alignToJobRun("qualification-timeout", nextRequalificationBusinessWindowAt(dueAt > now ? dueAt : now), now);
  return {
    ...status,
    nextEvent: { at: runAt.toISOString(), label: "Próxima requalificação automática", windowStartAt: firstDue.coldSince.toISOString() },
  };
}
