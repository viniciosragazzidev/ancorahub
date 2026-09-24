"use client";

import { useState } from "react";
import { StatefulButton } from "@/components/ui/stateful-button";

export function ConfirmDutyPresenceButton({ confirmationId }: { confirmationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function confirmPresence() {
    if (state === "loading" || state === "success") return;
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/public/duty-presence/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: confirmationId }),
      });
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !result?.success) throw new Error(result?.error || "Não foi possível confirmar agora.");
      setState("success");
      setMessage("Presença registrada. Você já pode receber leads deste plantão até o encerramento.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Tente novamente em instantes.");
      window.setTimeout(() => setState("idle"), 1400);
    }
  }

  return <div className="space-y-3">
    <StatefulButton className="w-full" onClick={confirmPresence} state={state} loadingText="Confirmando…" successText="Presença confirmada" errorText="Tentar novamente" />
    {message ? <p role={state === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">{message}</p> : null}
  </div>;
}
