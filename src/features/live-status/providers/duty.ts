/**
 * Itens 11 e 12 do plano no mesmo cartão: plantão agora (confirmados de escalados, fim do turno, próximo turno) e
 * quem ainda não confirmou presença, com a tolerância de 20 min depois do início (duty-presence-domain.ts).
 * Fonte: as linhas de presença do dia (duty_presence_confirmations), criadas pelo robô quando o turno abre.
 */
import { SELF_CONFIRM_TOLERANCE_MINUTES } from "@/features/lead-distribution/duty-presence-domain";

import { plural } from "../copy";
import type { LiveScope, LiveStatus } from "../types";

export type DutyPresenceRow = { status: string; shiftStartsAt: Date; shiftEndsAt: Date };

export function buildDutyStatus(input: { rows: readonly DutyPresenceRow[]; now: Date; scope: Pick<LiveScope, "role"> }): LiveStatus {
  const { now, scope } = input;
  const t = now.getTime();
  const own = scope.role === "broker";
  const running = input.rows.filter((row) => row.shiftStartsAt.getTime() <= t && row.shiftEndsAt.getTime() > t && row.status !== "absent");
  const confirmed = running.filter((row) => row.status === "confirmed").length;
  const pending = running.filter((row) => row.status === "pending");
  const toleranceMs = SELF_CONFIRM_TOLERANCE_MINUTES * 60_000;
  const openTolerance = pending
    .map((row) => row.shiftStartsAt.getTime() + toleranceMs)
    .filter((end) => end > t)
    .sort((a, b) => a - b)[0];
  const endsAt = running.map((row) => row.shiftEndsAt.getTime()).sort((a, b) => a - b)[0];
  const nextStart = input.rows.map((row) => row.shiftStartsAt.getTime()).filter((start) => start > t).sort((a, b) => a - b)[0];
  const href = own ? "/plantoes/agora" : scope.role === "director" || scope.role === "manager" ? "/leads/distribuicao?view=plantao" : undefined;
  const base = {
    id: "plantao",
    generatedAt: now.toISOString(),
    action: href ? { href, label: own ? "Abrir" : "Plantão" } : undefined,
  } as const;

  if (!running.length) {
    return {
      ...base,
      label: own ? "Seu plantão" : "Plantão agora",
      value: 0,
      emptyText: own ? "Você não está de plantão agora" : "Nenhum plantão acontecendo agora",
      severity: "ok",
      nextEvent: nextStart ? { at: new Date(nextStart).toISOString(), label: "O próximo começa", dueLabel: "Começando agora" } : undefined,
      explanation: nextStart ? "A confirmação de presença abre 30 min antes do início." : "Sem outro turno escalado para hoje.",
    };
  }

  if (own) {
    const mine = pending[0];
    return {
      ...base,
      label: "Seu plantão",
      value: 0,
      valueText: mine ? "Presença pendente" : "Presença confirmada",
      emptyText: "",
      severity: mine ? (openTolerance ? "atencao" : "critico") : "ok",
      nextEvent: mine && openTolerance
        ? { at: new Date(openTolerance).toISOString(), label: "Confirme sua presença; fecha", windowStartAt: mine.shiftStartsAt.toISOString(), dueLabel: "Fale com o supervisor para ser liberado" }
        : endsAt ? { at: new Date(endsAt).toISOString(), label: "O turno termina", dueLabel: "Turno encerrado" } : undefined,
      explanation: mine
        ? `Sem a confirmação, nenhum lead chega. Depois de ${SELF_CONFIRM_TOLERANCE_MINUTES} min do início, só o supervisor libera.`
        : "Você está recebendo os leads do plantão.",
    };
  }

  return {
    ...base,
    label: "Plantão agora",
    value: confirmed,
    valueText: `${confirmed} de ${running.length}`,
    emptyText: "",
    severity: pending.length ? (openTolerance ? "atencao" : "critico") : "ok",
    nextEvent: openTolerance
      ? { at: new Date(openTolerance).toISOString(), label: "A tolerância para confirmar acaba", dueLabel: "Só o supervisor libera agora" }
      : endsAt ? { at: new Date(endsAt).toISOString(), label: "O turno termina", dueLabel: "Turno encerrado" } : undefined,
    explanation: pending.length
      ? `${plural(pending.length, "corretor sem", "corretores sem")} confirmar presença. Depois de ${SELF_CONFIRM_TOLERANCE_MINUTES} min do início, só o supervisor libera.`
      : "Todos os escalados confirmaram a presença e recebem leads.",
    breakdown: [
      { label: "confirmados", value: confirmed },
      { label: "sem confirmar", value: pending.length },
    ],
  };
}
