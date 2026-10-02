"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { LEAD_TOAST_PREFERENCE_EVENT } from "@/components/providers/realtime-sync-provider";
import { setLeadToastEnabledAction } from "./actions";

/**
 * Turns the "Novo lead recebido" pop-up (toast + sound) on/off for this
 * person. The notification itself keeps arriving in the bell and here.
 */
export function LeadToastToggle({ initialEnabled }: { initialEnabled: boolean }) {
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
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Pop-up de novo lead</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {enabled
            ? "Aviso com som no canto da tela quando um lead chega para você."
            : "Desativado: os novos leads continuam aparecendo no sino e nesta página."}
        </span>
      </span>
      <Switch checked={enabled} onCheckedChange={change} disabled={pending} aria-label="Mostrar pop-up de novo lead" />
    </label>
  );
}
