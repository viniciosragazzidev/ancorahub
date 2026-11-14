"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/arc/button/button";
import { LiteSuccess } from "@/components/lite/motion/success";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

export type SettingFeedbackState =
  | { tone: "saving" }
  | { tone: "ok"; text: string }
  | { tone: "error"; text: string }
  | null;

/**
 * Configurações do Lite (docs/design-system/FEEDBACK.md, nível 1): "Salvando…" enquanto o servidor responde,
 * check no próprio controle quando confirma (vibração `confirm`, sem som) e, na falha, a causa normalizada,
 * o que continua valendo e "Tentar de novo".
 */
export function useSettingFeedback() {
  const fire = useFeedback();
  const [state, setState] = useState<SettingFeedbackState>(null);
  const start = useCallback(() => {
    setState({ tone: "saving" });
    fire("tap");
  }, [fire]);
  const ok = useCallback((text = "Salvo") => {
    setState({ tone: "ok", text });
    fire("confirm");
  }, [fire]);
  const fail = useCallback((cause: unknown, fallback: string, keeps: string) => {
    setState({ tone: "error", text: actionErrorMessage(normalizeActionError(cause, fallback), keeps) });
    fire("error");
  }, [fire]);
  const reset = useCallback(() => setState(null), []);
  return { state, start, ok, fail, reset };
}

/** Linha de estado embaixo do controle: "Salvando…", o check ou a causa com "Tentar de novo". */
export function SettingStatus({ state, onRetry }: { state: SettingFeedbackState; onRetry?: () => void }) {
  if (!state) return null;
  if (state.tone === "saving") return <span className="mt-2 block text-xs text-(--text-muted)" aria-live="polite">Salvando…</span>;
  if (state.tone === "ok") return <span className="mt-2 block text-xs font-medium text-(--success)"><LiteSuccess label={state.text} /></span>;
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <span role="alert" className="text-xs leading-5 text-(--foreground)">{state.text}</span>
      {onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Tentar de novo</Button> : null}
    </span>
  );
}
