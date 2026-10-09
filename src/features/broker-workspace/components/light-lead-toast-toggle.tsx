"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/arc/switch/switch";
import { toast } from "@/components/ui/sonner";
import { LEAD_TOAST_PREFERENCE_EVENT } from "@/components/providers/realtime-sync-provider";
import { setLeadToastEnabledAction } from "@/app/(dashboard)/notificacoes/actions";

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

/**
 * Light (arc-venancor) version of the "Novo lead recebido" pop-up toggle.
 * Same actions and rollback behavior as lead-toast-toggle.tsx, styled for the broker app.
 */
export function LightLeadToastToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setEnabled(next);
    window.dispatchEvent(new CustomEvent(LEAD_TOAST_PREFERENCE_EVENT, { detail: { enabled: next } }));
    startTransition(async () => {
      try {
        await setLeadToastEnabledAction(next);
      } catch {
        setEnabled(!next);
        window.dispatchEvent(new CustomEvent(LEAD_TOAST_PREFERENCE_EVENT, { detail: { enabled: !next } }));
        toast.error("Não foi possível salvar a preferência.");
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 p-4" style={CARD_STYLE}>
      <span className="min-w-0">
        <span className="block text-sm font-medium" style={{ color: "var(--foreground)" }}>Pop-up de novo lead</span>
        <span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          {enabled
            ? "Aviso com som no canto da tela quando um lead chega para você."
            : "Os novos leads continuam aparecendo no sino e nesta página."}
        </span>
      </span>
      <Switch checked={enabled} onCheckedChange={change} disabled={pending} aria-label="Mostrar pop-up de novo lead" />
    </div>
  );
}
