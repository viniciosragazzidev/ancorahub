"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";

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
      throw error;
    }
  }

  const label = state === "loading" ? "Confirmando…" : state === "success" ? "Presença confirmada" : state === "error" ? "Tentar novamente" : "Confirmar presença";

  // Visual Lite para todo mundo (Onda 8): o mesmo fluxo de estados do botão anterior (confirmar, confirmando, tentar de novo, confirmada).
  return <div style={{ display: "grid", gap: 12 }}>
    <Button type="button" className="w-full" loading={state === "loading"} disabled={state === "success"} onClick={() => { void confirmPresence().catch(() => undefined); }}>{label}</Button>
    {message ? <p role={state === "error" ? "alert" : "status"} style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{message}</p> : null}
  </div>;
}
