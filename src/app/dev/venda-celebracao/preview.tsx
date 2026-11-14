"use client";

import { useState } from "react";

import { SaleCelebration } from "@/components/lite/celebration/sale-celebration";

export function VendaCelebracaoPreview() {
  const [round, setRound] = useState(1);
  const [open, setOpen] = useState(true);
  return (
    <main className="arc-venancor grid min-h-dvh place-items-center bg-[var(--surface)] p-6">
      <button type="button" className="min-h-11 rounded-full border border-[var(--border)] px-5 text-sm" onClick={() => { setRound((n) => n + 1); setOpen(true); }}>
        Registrar venda de exemplo
      </button>
      <SaleCelebration
        open={open}
        celebrationKey={`preview-${round}`}
        onClose={() => setOpen(false)}
        stats={[{ label: "Valor mensal", value: "R$ 1.240" }, { label: "Vidas", value: "3" }, { label: "Vendas no mês", value: "5" }]}
      />
    </main>
  );
}
