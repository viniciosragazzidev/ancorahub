"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { motionTokens } from "@/components/arc/motion-tokens";
import type { ChatServerActionName } from "@/components/chat/types";
import { runChatServerAction, type ChatServerActionResult } from "@/features/broker-workspace/chat/chat-actions";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

type UndoAction = NonNullable<ChatServerActionResult["undo"]>["action"];
type Attempt = { id: string; name: ChatServerActionName; payload: Record<string, unknown> };

export type AgendaNotice =
  | { tone: "ok"; message: string; undo?: UndoAction }
  | { tone: "error"; message: string; retry: Attempt };

/** Rótulo do check no próprio item, depois que o servidor confirma. */
const DONE_LABEL: Partial<Record<ChatServerActionName, string>> = {
  "lead.completeReturn": "Concluído",
  "lead.cancelReturn": "Cancelado",
  "lead.scheduleReturn": "Reagendado",
};

/** O que continua valendo quando a ação falha. */
const KEEPS = "O retorno continua na sua agenda";

/**
 * Concluir, cancelar e reagendar na Agenda (docs/design-system/FEEDBACK.md, nível 1):
 * toque vibra curto; o check aparece no item só depois que o servidor confirma; concluir e reagendar
 * vibram `confirm` (sem som, são dezenas por dia); cancelar fica só no toque e mantém o "Desfazer".
 * A falha mostra a causa normalizada, o que continua valendo e "Tentar de novo".
 */
export function useAgendaAction() {
  const router = useRouter();
  const fire = useFeedback();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; label: string } | null>(null);
  const [notice, setNotice] = useState<AgendaNotice | null>(null);
  const doneTimer = useRef<number | null>(null);

  useEffect(() => () => { if (doneTimer.current) window.clearTimeout(doneTimer.current); }, []);

  function fail(attempt: Attempt, reason: unknown) {
    setNotice({ tone: "error", message: actionErrorMessage(normalizeActionError(reason, "Não consegui atualizar este item"), KEEPS), retry: attempt });
    fire("error");
  }

  async function execute(id: string, name: ChatServerActionName, payload: Record<string, unknown>): Promise<boolean> {
    const attempt: Attempt = { id, name, payload };
    setBusyId(id);
    fire("tap");
    try {
      const result = await runChatServerAction(name, payload);
      if (!result.ok) {
        fail(attempt, { message: result.message });
        return false;
      }
      setNotice({ tone: "ok", message: result.message, undo: result.undo?.action });
      const label = DONE_LABEL[name];
      if (label) {
        setDone({ id, label });
        if (doneTimer.current) window.clearTimeout(doneTimer.current);
        doneTimer.current = window.setTimeout(() => setDone(null), motionTokens.celebration.revertAfter * 1000);
      }
      if (name !== "lead.cancelReturn" && name !== "lead.reopenReturn") fire("confirm");
      router.refresh();
      return true;
    } catch (error) {
      fail(attempt, error);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function retry() {
    if (notice?.tone !== "error") return;
    const { id, name, payload } = notice.retry;
    void execute(id, name, payload);
  }

  return { busyId, done, notice, execute, retry };
}
