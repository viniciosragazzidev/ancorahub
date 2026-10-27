/**
 * Item 3 do plano: leads em qualificação pela IA e o próximo tempo limite.
 * O robô (qualification-timeout-sweep.ts) fecha a conversa parada há `timeoutMinutes` (padrão do tenant):
 * sem dado válido vira frio, com dado válido vira morno. A última atividade aqui é a da conversa da IA
 * (ou a chegada do lead); o robô também olha a última mensagem, então a hora é uma estimativa pelo passo do robô.
 */
import { alignToJobRun } from "../job-schedule";
import type { LiveScope, LiveStatus } from "../types";

export type QualifyingLeadRow = { lastActivityAt: Date };

export function buildAiQualificationStatus(input: { rows: readonly QualifyingLeadRow[]; timeoutMinutes: number; now: Date; scope: Pick<LiveScope, "canOpenQualification">; truncated?: boolean }): LiveStatus {
  const { rows, now } = input;
  const timeoutMs = Math.max(1, input.timeoutMinutes) * 60_000;
  const first = rows.reduce<QualifyingLeadRow | null>((best, row) => (!best || row.lastActivityAt < best.lastActivityAt ? row : best), null);
  const base: LiveStatus = {
    id: "qualificacao-ia",
    label: "Em qualificação pela IA",
    value: rows.length,
    valueText: input.truncated ? "500+" : undefined,
    emptyText: "Nenhum lead em qualificação agora",
    severity: rows.length ? "info" : "ok",
    explanation: rows.length
      ? input.truncated
        ? "A faixa atingiu o limite de contagem; consulte a fila para ver a lista completa."
        : "Quem não responder até lá vira frio; quem deu dado válido vira morno."
      : "A IA conversa com o lead novo; sem resposta no tempo limite, ele sai da qualificação.",
    action: input.scope.canOpenQualification ? { href: "/qualificacao", label: "Abrir" } : undefined,
    generatedAt: now.toISOString(),
  };
  if (!first) return base;
  const limit = new Date(first.lastActivityAt.getTime() + timeoutMs);
  const runAt = alignToJobRun("qualification-timeout", limit, now);
  return { ...base, nextEvent: { at: runAt.toISOString(), label: "Próximo tempo limite", windowStartAt: first.lastActivityAt.toISOString() } };
}
