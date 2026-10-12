"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/arc/switch/switch";
import { toast } from "@/components/ui/sonner";
import { decideAiConsentAction } from "@/features/ai-gateway/consent-actions";

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

/** LGPD: the broker turns the assistants' AI on or off at any time (each change is recorded). */
export function LightAiConsentToggle({ initialGranted }: { initialGranted: boolean }) {
  const [granted, setGranted] = useState(initialGranted);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setGranted(next);
    startTransition(async () => {
      const result = await decideAiConsentAction(next ? "granted" : "revoked").catch(() => ({ ok: false }));
      if (!result.ok) {
        setGranted(!next);
        toast.error("Não deu para salvar. Tente de novo.");
      }
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
      </span>
      <Switch checked={granted} onCheckedChange={change} disabled={pending} aria-label="Usar IA nas tarefas" />
    </div>
  );
}
