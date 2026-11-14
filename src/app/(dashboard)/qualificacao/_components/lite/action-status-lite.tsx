"use client";

/**
 * Feedback de nível 1 (docs/design-system/FEEDBACK.md §3) das ações de salvar e configurar do hub Lite:
 * o botão mostra "Salvando…" enquanto o servidor responde, a confirmação aparece na própria seção só depois
 * que ele confirma (`fire("confirm")`), e a falha mostra a causa normalizada, o que continua valendo e
 * "Tentar de novo" (`fire("error")`). Sem toast repetindo o que já aparece na tela.
 */
import { useCallback, useState, type ReactNode } from "react";

import { LiteSuccess } from "@/components/lite/motion/success";
import sections from "@/components/lite/page/lite-sections.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { actionErrorMessage, isFailedResult, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

export type ActionStatus =
  | { state: "busy" }
  | { state: "done"; label: string }
  | { state: "error"; message: string; retry?: () => void };

export type ActionOptions = { done: string; fallback: string; keeps?: string };

function failed(result: unknown) {
  return isFailedResult(result) || Boolean(result && typeof result === "object" && (result as { success?: unknown }).success === false);
}

export function useActionStatus() {
  const fire = useFeedback();
  const [status, setStatus] = useState<Record<string, ActionStatus | undefined>>({});

  const set = useCallback((key: string, value: ActionStatus | undefined) => setStatus((current) => ({ ...current, [key]: value })), []);
  const clear = useCallback((key: string) => set(key, undefined), [set]);

  /** Erro sem servidor (validação): mostra a causa no lugar, sem "Tentar de novo". */
  const invalid = useCallback((key: string, message: string) => {
    fire("error");
    set(key, { state: "error", message });
  }, [fire, set]);

  const run = useCallback(async function run<T>(key: string, task: () => Promise<T>, options: ActionOptions): Promise<T | undefined> {
    set(key, { state: "busy" });
    fire("tap");
    try {
      const result = await task();
      if (failed(result)) throw result;
      fire("confirm");
      set(key, { state: "done", label: options.done });
      return result;
    } catch (error) {
      fire("error");
      const info = normalizeActionError(error, options.fallback);
      set(key, { state: "error", message: actionErrorMessage(info, options.keeps), retry: info.retryable ? () => void run(key, task, options) : undefined });
      return undefined;
    }
  }, [fire, set]);

  const busy = useCallback((key: string) => status[key]?.state === "busy", [status]);

  return { status, run, invalid, clear, busy };
}

/** Rótulo do botão enquanto envia: spinner e o verbo no gerúndio. */
export function BusyLabel({ busy, label, children }: { busy: boolean; label: string; children: ReactNode }) {
  if (!busy) return <>{children}</>;
  return (
    <>
      <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      {label}
    </>
  );
}

/** Confirmação ou erro na própria seção. O erro fica até o próximo envio e oferece "Tentar de novo". */
export function ActionNote({ status }: { status?: ActionStatus }) {
  if (!status || status.state === "busy") return null;
  if (status.state === "done") return <LiteSuccess label={status.label} className="text-sm text-[var(--success)]" />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="alert" className={sections.error}>{status.message}</p>
      {status.retry ? <button type="button" className={page.button} onClick={status.retry}>Tentar de novo</button> : null}
    </div>
  );
}
