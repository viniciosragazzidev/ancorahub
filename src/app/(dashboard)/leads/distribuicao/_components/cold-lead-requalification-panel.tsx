"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { toast } from "@/components/ui/sonner";
import { requalifyColdLeadsAction } from "@/features/ai-qualification/cold-lead-requalification-actions";
import { useRouter } from "next/navigation";

type ColdReviewLead = { id: string; nome: string; createdAt: Date };
type QueueReview = { noResponse: ColdReviewLead[]; respondedStillCold: ColdReviewLead[] };
const EMPTY_QUEUE_REVIEW: QueueReview = { noResponse: [], respondedStillCold: [] };

export function ColdLeadRequalificationPanel({
  queues,
  leadsByQueue,
  since,
}: {
  queues: Array<{ id: string; name: string }>;
  leadsByQueue: Record<string, QueueReview>;
  since: Date;
}) {
  const router = useRouter();
  const [queueId, setQueueId] = useState(queues[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmationIds, setConfirmationIds] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: Array<{ leadId: string; name: string; reason: string }> } | null>(null);
  const queueReview = useMemo(() => leadsByQueue[queueId] ?? EMPTY_QUEUE_REVIEW, [leadsByQueue, queueId]);
  const allLeads = useMemo(() => [...queueReview.noResponse, ...queueReview.respondedStillCold], [queueReview]);
  const eligibleIds = allLeads.map((lead) => lead.id);

  function toggle(leadId: string) {
    setSelectedIds((current) => current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]);
  }

  async function submit(ids: string[]) {
    if (!queueId || !ids.length) return;
    setIsSubmitting(true);
    setResult(null);
    const response = await requalifyColdLeadsAction({ queueId, leadIds: ids });
    setIsSubmitting(false);
    setConfirmationIds(null);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    setResult({ sent: response.sent, skipped: response.skipped });
    setSelectedIds([]);
    toast.success(`${response.sent} requalificado(s)`, { description: `${response.skipped.length} pulado(s).` });
    router.refresh();
  }

  const renderGroup = (title: string, leads: ColdReviewLead[]) => (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>
      {leads.length ? (
        <ul className="max-h-64 space-y-1 overflow-auto rounded-[var(--radius-card)] border border-border/70 p-2">
          {leads.map((lead) => (
            <li key={lead.id} className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/30">
              <Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggle(lead.id)} aria-label={`Selecionar ${lead.nome}`} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{lead.nome || "Lead sem nome"}</span>
              <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={lead.createdAt.toISOString()}>
                {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(lead.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-xs text-muted-foreground">Nenhum lead neste grupo hoje.</p>}
    </section>
  );

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <SectionCardHeader title="Requalificar leads frios" description="Leads frios recebidos no dia operacional da fila. A mensagem segue o canal oficial de qualificacao." />
      {!queues.length ? <p className="text-sm text-muted-foreground">Crie uma fila ativa para revisar leads frios.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Fila
              <select value={queueId} onChange={(event) => { setQueueId(event.target.value); setSelectedIds([]); setResult(null); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">Dia operacional desde {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(since)}.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {renderGroup("Nao responderam", queueReview.noResponse)}
            {renderGroup("Responderam e ficaram frios", queueReview.respondedStillCold)}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(eligibleIds)}>Selecionar todos</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Limpar selecao</Button>
            <span className="flex-1 text-xs text-muted-foreground">{selectedIds.length} selecionado(s)</span>
            <Button type="button" variant="outline" size="sm" disabled={!selectedIds.length || isSubmitting} onClick={() => setConfirmationIds(selectedIds)}>Requalificar selecionados</Button>
            <Button type="button" size="sm" disabled={!eligibleIds.length || isSubmitting} onClick={() => setConfirmationIds(eligibleIds)}>Requalificar todos ({eligibleIds.length})</Button>
          </div>
          {result ? (
            <div role="status" className="rounded-[var(--radius-card)] border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="font-semibold">{result.sent} reenviado(s), {result.skipped.length} pulado(s)</p>
              {result.skipped.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{result.skipped.map((item, index) => <li key={`${item.leadId}-${index}`}><strong className="text-foreground">{item.name}:</strong> {item.reason}</li>)}</ul> : null}
            </div>
          ) : null}
        </>
      )}
      <Dialog open={confirmationIds !== null} onOpenChange={(open) => { if (!open && !isSubmitting) setConfirmationIds(null); }}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Confirmar requalificacao</DialogTitle>
              <DialogDescription>O template oficial de qualificacao sera enviado para {confirmationIds?.length ?? 0} lead(s). Leads com opt-out, numero invalido, envio recente ou que sairam da fila serao pulados.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setConfirmationIds(null)}>Voltar</Button>
              <Button type="button" disabled={isSubmitting} onClick={() => confirmationIds && void submit(confirmationIds)}>{isSubmitting ? "Enviando..." : "Confirmar envio"}</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </Card>
  );
}
