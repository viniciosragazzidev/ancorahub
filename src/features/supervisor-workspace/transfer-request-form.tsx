"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestBrokerTransferAction, type TransferCandidate } from "./transfer-actions";

export function TransferRequestForm({ candidates }: { candidates: TransferCandidate[] }) {
  const [availableCandidates, setAvailableCandidates] = useState(candidates);
  const [brokerId, setBrokerId] = useState(candidates[0]?.brokerId ?? "");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    startTransition(async () => {
      const result = await requestBrokerTransferAction({ brokerId, reason });
      if (!result.ok) {
        setFeedback(result.reason);
        return;
      }
      setAvailableCandidates((current) => current.filter((candidate) => candidate.brokerId !== brokerId));
      setBrokerId((current) => current === brokerId ? (availableCandidates.find((candidate) => candidate.brokerId !== current)?.brokerId ?? "") : current);
      setReason("");
      setFeedback("Pedido enviado para aprovação da gestão.");
    });
  }

  if (!availableCandidates.length) {
    return <p className="rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">Não há corretores ativos de outra equipe nesta unidade.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-sm">
      <div>
        <label htmlFor="transfer-broker" className="mb-1.5 block text-sm font-medium">Corretor</label>
        <select id="transfer-broker" value={brokerId} onChange={(event) => setBrokerId(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
          {availableCandidates.map((candidate) => <option key={candidate.brokerId} value={candidate.brokerId}>{candidate.brokerName} · equipe de {candidate.currentSupervisorName}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="transfer-reason" className="mb-1.5 block text-sm font-medium">Por que você quer trazer este corretor para sua equipe?</label>
        <Textarea id="transfer-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required rows={3} placeholder="Explique brevemente o pedido" />
      </div>
      <Button type="submit" disabled={isPending || !brokerId || !reason.trim()} loading={isPending}>Pedir transferência</Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-[var(--text-muted)]">{feedback}</p>
    </form>
  );
}
