"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";

export function ConfirmDutyPresenceButton({ confirmationId }: { confirmationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Regra de 06/11: sem WhatsApp conectado, a confirmação vai para o app (aqui não há login para conectar).
  const [needsWhatsApp, setNeedsWhatsApp] = useState(false);

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
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string; code?: string } | null;
      if (result?.code === "whatsapp_required") {
        setNeedsWhatsApp(true);
        setState("idle");
        setMessage("A partir de 06/11, a presença no plantão só é confirmada com o seu WhatsApp conectado. Abra o app: ele mostra o código para conectar e confirma a presença em seguida.");
        return;
      }
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
  if (needsWhatsApp) {
    return <div style={{ display: "grid", gap: 12 }}>
      <Button type="button" className="w-full" onClick={() => { window.location.assign("/plantoes/agora"); }}>Abrir no app para conectar</Button>
      <p role="alert" style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{message}</p>
    </div>;
  }

  return <div style={{ display: "grid", gap: 12 }}>
    <Button type="button" className="w-full" loading={state === "loading"} disabled={state === "success"} onClick={() => { void confirmPresence().catch(() => undefined); }}>{label}</Button>
    {message ? <p role={state === "error" ? "alert" : "status"} style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{message}</p> : null}
  </div>;
}
