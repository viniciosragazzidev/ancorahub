"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopySaleDetailsButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
    }
  }

  return <div className="flex flex-col items-start gap-1 sm:items-end">
    <Button type="button" size="sm" variant="outline" onClick={copySummary}>
      {status === "copied" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {status === "copied" ? "Resumo copiado" : "Copiar resumo"}
    </Button>
    <span aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
      {status === "error" ? "Não foi possível copiar. Selecione o texto e copie manualmente." : status === "copied" ? "Resumo copiado para a área de transferência." : ""}
    </span>
  </div>;
}
