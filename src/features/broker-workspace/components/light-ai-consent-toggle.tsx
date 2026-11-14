"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/arc/switch/switch";
import { decideAiConsentAction } from "@/features/ai-gateway/consent-actions";

import { SettingStatus, useSettingFeedback } from "./light-setting-feedback";

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

/**
 * LGPD: the broker turns the assistants' AI on or off at any time (each change is recorded).
 * Nível 1: o interruptor muda na hora com "Salvando…", confirma com o check depois do servidor e, se falhar,
 * volta ao estado anterior com a causa e "Tentar de novo".
 */
export function LightAiConsentToggle({ initialGranted }: { initialGranted: boolean }) {
  const [granted, setGranted] = useState(initialGranted);
  const [pending, startTransition] = useTransition();
  const [retryValue, setRetryValue] = useState<boolean | null>(null);
  const feedback = useSettingFeedback();

  function change(next: boolean) {
    setGranted(next);
    setRetryValue(null);
    feedback.start();
    startTransition(async () => {
      const result: { ok: boolean; error?: unknown } = await decideAiConsentAction(next ? "granted" : "revoked").catch((error: unknown) => ({ ok: false, error }));
      if (!result.ok) {
        setGranted(!next);
        setRetryValue(next);
        feedback.fail(result.error ?? null, "Não deu para salvar", next ? "A IA continua desligada" : "A IA continua ligada");
        return;
      }
      feedback.ok(next ? "IA ligada" : "IA desligada");
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 p-4" style={CARD_STYLE}>
      <span className="min-w-0">
        <span className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>IA nas tarefas</span>
        <span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          {granted
            ? "Os assistentes usam IA de outras empresas, fora do Brasil, para responder o que você escreve."
            : "Desligada. Os assistentes respondem só pelas opções e pelo @."}
        </span>
        <SettingStatus state={feedback.state} onRetry={retryValue === null ? undefined : () => change(retryValue)} />
      </span>
      <Switch checked={granted} onCheckedChange={change} disabled={pending} aria-label="Usar IA nas tarefas" />
    </div>
  );
}
