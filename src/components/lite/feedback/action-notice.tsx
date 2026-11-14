"use client";

/**
 * Confirmação no próprio objeto para ações de nível 1 que não cabem no LiteActionButton
 * (botões de linha, menus, formulários com useActionState). Docs: docs/design-system/FEEDBACK.md §3 e §8.
 *
 * - `tap()` no toque (vibração curta);
 * - `succeed(texto)` só depois que o servidor confirma: check desenhado e o texto nomeando o resultado;
 * - `fail(causa, { keeps, retry })`: causa normalizada (nunca texto técnico), o que continua valendo e
 *   "Tentar de novo". O texto entra no ritmo (+80 ms).
 * Som e vibração só via useFeedback. Sem toast repetindo o que aparece aqui.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { LiteSuccess } from "@/components/lite/motion/success";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { cn } from "@/lib/utils";

export type ActionNotice =
  | { tone: "success"; text: string; id: number }
  | { tone: "error"; text: string; id: number; retry?: () => void };

export type SucceedOptions = {
  /** Som de confirmação: só para ação ocasional. */
  sound?: boolean;
  /** Nível 2 (marco), com limite diário por chave. */
  milestone?: { budgetKey: string };
};

export type FailOptions = {
  /** O que continua valendo ("O lead continua com Ana."). */
  keeps?: string;
  /** Texto quando a causa não é legível. */
  fallback?: string;
  /** Refaz a ação; vira o botão "Tentar de novo". */
  retry?: () => void;
};

let sequence = 0;

export function useActionNotice() {
  const fire = useFeedback();
  const [notice, setNotice] = useState<ActionNotice | null>(null);

  const tap = useCallback(() => { fire("tap"); }, [fire]);
  const clear = useCallback(() => setNotice(null), []);

  const succeed = useCallback((text: string, options: SucceedOptions = {}) => {
    const plan = options.milestone ? fire("milestone", { budgetKey: options.milestone.budgetKey }) : fire("confirm", { sound: options.sound });
    sequence += 1;
    setNotice({ tone: "success", text, id: sequence });
    return plan;
  }, [fire]);

  const fail = useCallback((cause: unknown, options: FailOptions = {}) => {
    const info = normalizeActionError(cause, options.fallback);
    fire("error");
    sequence += 1;
    setNotice({ tone: "error", text: actionErrorMessage(info, options.keeps), id: sequence, retry: info.retryable ? options.retry : undefined });
    return info;
  }, [fire]);

  return useMemo(() => ({ notice, tap, succeed, fail, clear }), [notice, tap, succeed, fail, clear]);
}

type ActionStateLike = { success?: boolean; error?: string; needsAssignmentMode?: boolean };

/**
 * Para formulários com useActionState: cada resultado novo do servidor dispara uma vez
 * `confirm` (sucesso) ou `error` (falha). O estado inicial não dispara nada, e a pergunta
 * "atribuir direto ou enviar oferta" não é erro.
 */
export function useActionStateFeedback(state: ActionStateLike, options: { sound?: boolean } = {}) {
  const fire = useFeedback();
  const seen = useRef(state);
  const sound = options.sound;
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (state.success) fire("confirm", { sound });
    else if (state.error && !state.needsAssignmentMode) fire("error");
  }, [fire, sound, state]);
}

/** A linha de resultado: check + texto (sucesso) ou causa + "Tentar de novo" (falha). */
export function ActionNoticeLine({ notice, className, retryLabel = "Tentar de novo" }: { notice: ActionNotice | null; className?: string; retryLabel?: string }) {
  const motionOn = useInterfaceMotionEnabled();
  if (!notice) return null;
  if (notice.tone === "success") {
    return <LiteSuccess key={notice.id} label={notice.text} className={cn("text-sm font-medium text-(--success)", className)} />;
  }
  return (
    <motion.div
      key={notice.id}
      role="alert"
      data-notice="error"
      className={cn("grid justify-items-start gap-1 text-sm text-(--danger)", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionOn ? motionTokens.duration.fast : motionTokens.duration.instant, delay: motionTokens.beat.text }}
    >
      <p className="m-0">{notice.text}</p>
      {notice.retry ? <button type="button" className="font-medium underline underline-offset-2" onClick={notice.retry}>{retryLabel}</button> : null}
    </motion.div>
  );
}
