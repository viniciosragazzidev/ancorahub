"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function BrokerLeadsExportButton({ brokerId, compact = false }: { brokerId: string; compact?: boolean }) {
  const [includeClosed, setIncludeClosed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportLeads() {
    setBusy(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ includeClosed: String(includeClosed) });
      const response = await fetch(`/api/team/brokers/${encodeURIComponent(brokerId)}/leads/export?${query}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível exportar os leads.");
      }

      const blob = await response.blob();
      const filename = response.headers.get("X-Export-Filename") || "leads-corretor.csv";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      const total = Number(response.headers.get("X-Export-Rows") ?? 0);
      setMessage(total === 0 ? "Arquivo baixado sem leads neste escopo." : `${total} lead${total === 1 ? "" : "s"} exportado${total === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível exportar os leads.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={includeClosed} disabled={busy} onCheckedChange={(checked) => setIncludeClosed(checked === true)} />
        Incluir convertidos e perdidos
      </label>
      <Button size={compact ? "sm" : "default"} variant="outline" disabled={busy} onClick={exportLeads}>
        <Download className="size-4" aria-hidden="true" />
        {busy ? "Gerando…" : "Exportar leads"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground" role="status" aria-live="polite">{message}</span> : null}
    </div>
  );
}
