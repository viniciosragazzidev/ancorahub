/**
 * Nível de feedback de cada ação do chat (docs/design-system/FEEDBACK.md §3, fase 2 do plano).
 * Um ponto só: o ChatScreen consulta esta tabela ao rodar a ação de uma resposta sugerida.
 * - level 0: silencioso (nota, marcar lida). Nem toque, nem som.
 * - level 1: toque ao escolher e confirmação ao concluir; `success` diz qual vibração usar no sucesso
 *   e `sound` liga o som de confirmação (só ação ocasional).
 * Falha de qualquer ação: som e vibração de erro. Sucesso com ressalva (warning): alerta.
 */
import type { FeedbackKind } from "@/lib/feedback/tokens";

import type { ChatServerActionName } from "./types";

export type ChatActionFeedback = { level: 0 } | { level: 1; success: Extract<FeedbackKind, "confirm" | "tap">; sound?: true };

export const CHAT_ACTION_FEEDBACK: Record<ChatServerActionName, ChatActionFeedback> = {
  "lead.accept": { level: 1, success: "confirm" },
  "lead.registerContact": { level: 1, success: "confirm" },
  "lead.changeStep": { level: 1, success: "confirm" },
  "lead.scheduleReturn": { level: 1, success: "confirm" },
  "lead.completeReturn": { level: 1, success: "confirm" },
  "lead.cancelReturn": { level: 1, success: "tap" },
  "lead.reopenReturn": { level: 1, success: "tap" },
  "lead.decline": { level: 1, success: "tap" },
  "lead.markLost": { level: 1, success: "tap" },
  "duty.pause": { level: 1, success: "confirm", sound: true },
  "duty.resume": { level: 1, success: "confirm", sound: true },
  "lead.addNote": { level: 0 },
  "notifications.markRead": { level: 0 },
  "relationship.ack": { level: 0 },
  "team.addBroker": { level: 0 },
};

type Fire = (kind: FeedbackKind, options?: { sound?: boolean }) => unknown;

/** Toque ao escolher: só ações de nível 1. */
export function feedbackOnChoose(name: ChatServerActionName, fire: Fire) {
  if (CHAT_ACTION_FEEDBACK[name].level === 1) fire("tap");
}

/** Resultado da ação: confirmação, alerta (deu certo em parte) ou erro. */
export function feedbackOnResult(name: ChatServerActionName, result: { ok: boolean; warning?: boolean } | "failed", fire: Fire) {
  if (result === "failed" || !result.ok) { fire("error"); return; }
  if (result.warning) { fire("warning"); return; }
  const spec = CHAT_ACTION_FEEDBACK[name];
  if (spec.level === 1) fire(spec.success, spec.sound ? { sound: true } : undefined);
}
