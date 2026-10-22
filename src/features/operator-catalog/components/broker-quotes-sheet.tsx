"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";

import { getBrokerQuotesImportAction, pauseBrokerQuotesImportAction, startBrokerQuotesImportAction } from "../actions";

type Status = Awaited<ReturnType<typeof getBrokerQuotesImportAction>>;

const STATE_LABEL: Record<string, { label: string; variant: "info" | "secondary" | "success" }> = {
  running: { label: "Importando", variant: "info" },
  paused: { label: "Pausada", variant: "secondary" },
  done: { label: "Concluída", variant: "success" },
};

function Line({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

/** Start, pause and follow the import of the PDFs brokers sent to leads (their quotes). */
export function BrokerQuotesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    getBrokerQuotesImportAction().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    // While it runs, the numbers move every catalog round (5 min); a light refresh is enough.
    const timer = window.setInterval(load, 20_000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  const run = (task: () => Promise<{ success: boolean; message?: string; error?: string }>) => startTransition(async () => {
    const result = await task();
    if (result.success) toast.success(result.message ?? "Pronto.");
    else toast.error(result.error ?? "Não foi possível agora.");
    load();
  });

  const state = status?.state ?? null;
  const badge = state ? STATE_LABEL[state.status] : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,30rem)]">
        <SheetHeader>
          <SheetTitle>Cotações enviadas aos leads</SheetTitle>
          <SheetDescription>
            Os PDFs que os corretores mandaram aos leads pelo WhatsApp. Cada um é lido pela IA: cotações viram preço observado no catálogo (por operadora, plano e faixa); boleto, proposta e documentos são descartados. O texto nunca aparece nas respostas do assistente.
          </SheetDescription>
        </SheetHeader>
        <SheetBody contentClassName="grid gap-4">
          {!status ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
            <>
              <div className="flex items-center gap-2">
                {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <Badge variant="secondary">Não iniciada</Badge>}
                <span className="text-xs text-muted-foreground">Um lote de 10 a cada 5 minutos, na tarefa do catálogo.</span>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border px-4">
                <Line label="PDFs enviados aos leads" value={status.total} />
                <Line label="Ainda não lidos" value={status.remaining} />
                <Line label="Lidos" value={state?.read ?? 0} />
                <Line label="Novos no catálogo" value={state?.captured ?? 0} />
                <Line label="Repetidos (mesmo arquivo)" value={state?.duplicated ?? 0} />
                <Line label="Ilegíveis ou fora do padrão" value={state?.unreadable ?? 0} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Depois de lidos, a IA separa o que é cotação. O resultado aparece em Revisão (cotação diferente da tabela) e no Catálogo de cada operadora.
              </p>
              <div className="flex gap-2">
                {state?.status === "running" ? (
                  <Button variant="outline" disabled={pending} onClick={() => run(pauseBrokerQuotesImportAction)}>Pausar</Button>
                ) : (
                  <Button disabled={pending || status.remaining === 0} onClick={() => run(startBrokerQuotesImportAction)}>
                    {state ? "Continuar importação" : "Iniciar importação"}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
