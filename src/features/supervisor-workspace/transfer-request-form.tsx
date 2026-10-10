"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import ChipGroup from "@/components/arc/chip-group/chip-group";
import { Textarea } from "@/components/arc/textarea/textarea";
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
    <form onSubmit={submit} className="arc-venancor space-y-4 rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-[var(--shadow-resting)]">
      <div>
        <p className="mb-2 text-sm font-medium">Quem você quer trazer para sua equipe?</p>
        <ChipGroup label="Corretor para transferência" multiple={false} options={availableCandidates.map((candidate) => ({ value: candidate.brokerId, label: candidate.brokerName }))} value={brokerId ? [brokerId] : []} onValueChange={(values) => setBrokerId(values[0] ?? "")} />
        {availableCandidates.find((candidate) => candidate.brokerId === brokerId) ? <small className="text-sm text-[var(--text-muted)]">Equipe de {availableCandidates.find((candidate) => candidate.brokerId === brokerId)?.currentSupervisorName}</small> : null}
      </div>
      <Textarea id="transfer-reason" label="Por que você quer trazer este corretor para sua equipe?" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required rows={3} placeholder="Explique brevemente o pedido" />
      <Button type="submit" disabled={isPending || !brokerId || !reason.trim()} loading={isPending}>Pedir transferência</Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-[var(--text-muted)]">{feedback}</p>
    </form>
  );
}
