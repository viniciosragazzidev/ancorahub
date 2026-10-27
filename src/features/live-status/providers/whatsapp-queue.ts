/**
 * Item 16 do plano: a fila de envio do WhatsApp (whatsapp_outbound_messages): quantas esperam, quantas estão
 * seguradas (fora do horário, espaçamento entre envios, limite) e quando saem, e as falhas do dia.
 * O robô `whatsapp` roda a cada minuto; o heartbeat diz se ele parou.
 */
import { formatAgo } from "@/components/lite/status/format";

import { plural } from "../copy";
import { jobHealth, type JobHeartbeat } from "../heartbeat-format";
import { alignToJobRun } from "../job-schedule";
import type { LiveScope, LiveStatus } from "../types";

export type WhatsAppQueueAggregate = {
  waiting: number;
  held: number;
  /** Quando a primeira segurada sai (next_attempt_at ou scheduled_at). */
  heldUntil: Date | null;
  /** Próxima mensagem livre (sem motivo de espera). */
  nextFreeAt: Date | null;
  failedToday: number;
  topErrorCode: string | null;
};

const ERROR_LABELS: Record<string, string> = {
  "131026": "número sem WhatsApp",
  "131047": "fora da janela de 24 h",
  "131049": "limite da Meta para o mesmo número",
  "131050": "o cliente pediu para não receber",
  "131051": "tipo de mensagem não aceito",
  "132001": "modelo não aprovado",
  "130429": "limite de envio da Meta",
};

export function describeWhatsAppError(code: string | null) {
  if (!code) return null;
  return ERROR_LABELS[code] ?? `código ${code}`;
}

export function buildWhatsAppQueueStatus(input: { aggregate: WhatsAppQueueAggregate; heartbeat: JobHeartbeat | null; now: Date; scope: Pick<LiveScope, "role"> }): LiveStatus {
  const { aggregate, now } = input;
  const health = jobHealth("whatsapp", input.heartbeat, now);
  const failedText = aggregate.failedToday
    ? `${plural(aggregate.failedToday, "falhou", "falharam")} hoje${describeWhatsAppError(aggregate.topErrorCode) ? `: ${describeWhatsAppError(aggregate.topErrorCode)}` : ""}.`
    : null;
  const stalled = health === "atrasado" && aggregate.waiting > 0;
  const nextEvent = aggregate.held && aggregate.heldUntil
    ? { at: aggregate.heldUntil.toISOString(), label: aggregate.held === 1 ? "A segurada sai" : "As seguradas saem", dueLabel: "Saindo agora" }
    : aggregate.waiting && aggregate.nextFreeAt
      ? { at: alignToJobRun("whatsapp", aggregate.nextFreeAt, now).toISOString(), label: "Próximo envio", dueLabel: "Enviando agora" }
      : undefined;
  return {
    id: "whatsapp-fila",
    label: "Mensagens na fila do WhatsApp",
    value: aggregate.waiting,
    emptyText: "Nenhuma mensagem esperando envio",
    severity: stalled ? "critico" : aggregate.failedToday ? "atencao" : aggregate.waiting ? "info" : "ok",
    nextEvent,
    lastEvent: !nextEvent && input.heartbeat ? { at: input.heartbeat.finishedAt, label: "Última rodada" } : undefined,
    explanation: stalled
      ? `O envio do WhatsApp não roda ${formatAgo(now.getTime() - new Date(input.heartbeat!.finishedAt).getTime())}. ${input.scope.role === "director" ? "Avise o Vinicios." : "Avise o diretor."}`
      : failedText ?? (aggregate.held
        ? "Mensagens fora do horário ou do espaçamento entre envios esperam a hora certa."
        : "Qualificação, ofertas e avisos saem por aqui, uma rodada por minuto."),
    breakdown: aggregate.waiting || aggregate.failedToday
      ? [
          { label: "seguradas", value: aggregate.held },
          { label: "falhas hoje", value: aggregate.failedToday },
        ]
      : undefined,
    action: input.scope.role === "director" ? { href: "/integrations/whatsapp", label: "Abrir canal" } : undefined,
    generatedAt: now.toISOString(),
  };
}
