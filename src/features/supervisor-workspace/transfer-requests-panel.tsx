"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { decideBrokerTransferAction, type PendingTransferRequest } from "./transfer-actions";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" });

export function TransferRequestsPanel({ requests: initialRequests }: { requests: PendingTransferRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  function decide(requestId: string, approve: boolean) {
    setFeedback("");
    setActiveRequestId(requestId);
    startTransition(async () => {
      const result = await decideBrokerTransferAction(requestId, approve);
      setActiveRequestId(null);
      if (!result.ok) {
        setFeedback(result.reason);
        return;
      }
      setRequests((current) => current.filter((request) => request.id !== requestId));
      setFeedback(approve ? "Transferência aprovada." : "Pedido recusado.");
    });
  }

  return (
    <section aria-labelledby="transfer-requests-title" className="rounded-[var(--radius-panel)] border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="transfer-requests-title" className="text-base font-semibold">Pedidos de transferência</h2>
        <span className="text-sm text-muted-foreground">{requests.length} pendente{requests.length === 1 ? "" : "s"}</span>
      </div>
      {!requests.length ? <p className="text-sm text-muted-foreground">Nenhum pedido aguardando decisão.</p> : (
        <ul className="divide-y divide-border">
          {requests.map((request) => (
            <li key={request.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{request.brokerName} · {request.branchName}</p>
                <p className="text-sm text-muted-foreground">{request.fromSupervisorName} → {request.toSupervisorName} · {dateFormat.format(new Date(request.createdAt))}</p>
                <p className="text-sm">{request.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide(request.id, true)} disabled={isPending} loading={isPending && activeRequestId === request.id}>Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => decide(request.id, false)} disabled={isPending}>Recusar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">{feedback}</p>
    </section>
  );
}
