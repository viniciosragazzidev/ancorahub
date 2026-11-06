"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { applyStaleStageRuleAction, refreshStaleStageSimulationAction } from "@/features/leads/stale-stage-actions";
import type { StaleSimulation } from "@/features/leads/stale-stage-sweep";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

/**
 * Regra de chat parado em simulação (05/11): o diretor vê o que a regra faria e liga com um toque.
 * Some quando a regra é ligada.
 */
export function StaleStageSimulationCard({ simulation }: { simulation: StaleSimulation | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ ok: true; message: string } | { ok: false; reason: string }>) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) toast.success(result.message);
      else toast.error(result.reason);
      router.refresh();
    });
  }

  const total = simulation ? simulation.toAwaiting + simulation.toLost : 0;
  const at = simulation ? new Date(simulation.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <section aria-label="Regra de chat parado" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Limpeza de chats parados (simulação)</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {simulation
            ? total
              ? `${simulation.toAwaiting} iriam para Aguardando retorno e ${simulation.toLost} para Perdido (sem contato). Conferido em ${at}.`
              : `Nenhum lead parado agora. Conferido em ${at}.`
            : "Veja quais leads em cotação, negociação e fechamento estão com o cliente sem responder."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {simulation && total ? <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Ver lista</Button> : null}
        {simulation
          ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(applyStaleStageRuleAction)}>Aplicar e ligar</Button>
          : <Button size="sm" variant="outline" disabled={pending} onClick={() => run(refreshStaleStageSimulationAction)}>Gerar simulação</Button>}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>O que a regra faria hoje</SheetTitle>
            <SheetDescription>5 dias úteis sem resposta do cliente: Aguardando retorno. Mais 10 sem resposta: Perdido (sem contato). Se o cliente responder, o lead volta sozinho.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul className="divide-y divide-border/60">
              {simulation?.items.map((item) => (
                <li key={`${item.leadId}:${item.action}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/leads/${item.leadId}`} className="block truncate text-sm font-medium text-foreground hover:underline">{item.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{item.brokerName ?? "Sem corretor"} · {LEAD_STATUS_LABELS[item.status] ?? item.status} · {item.businessDays} dias úteis</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {item.action === "to_awaiting" ? "Aguardando retorno" : "Perdido"}
                  </span>
                </li>
              ))}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </section>
  );
}
