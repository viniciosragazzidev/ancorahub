"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCustomerRenewalStatusAction } from "@/features/post-sale/actions";

const renewalOptions = [
  { value: "pending_window", label: "Acompanhar no prazo" },
  { value: "in_renewal", label: "Renovação em andamento" },
  { value: "renewed", label: "Renovado" },
  { value: "churned", label: "Não renovado" },
] as const;

type RenewalStatus = (typeof renewalOptions)[number]["value"];

export function CustomerRenewalStatus({
  activeCustomerId,
  initialStatus,
  initialNotes,
  disabled = false,
}: {
  activeCustomerId: string;
  initialStatus: RenewalStatus;
  initialNotes: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RenewalStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateCustomerRenewalStatusAction({
        activeCustomerId,
        renewalStatus: status,
        renewalNotes: notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Acompanhamento de renovação atualizado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 border-t border-border/40 pt-3">
      <div className="space-y-1.5">
        <Label htmlFor={`renewal-status-${activeCustomerId}`}>Andamento</Label>
        <select
          id={`renewal-status-${activeCustomerId}`}
          value={status}
          onChange={(event) => setStatus(event.target.value as RenewalStatus)}
          disabled={disabled || pending}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {renewalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`renewal-notes-${activeCustomerId}`}>Observação</Label>
        <Input id={`renewal-notes-${activeCustomerId}`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: proposta enviada, aguardando retorno" maxLength={1000} disabled={disabled || pending} />
      </div>
      <Button type="button" size="sm" className="w-full" onClick={save} disabled={disabled || pending}>
        {pending ? "Salvando..." : "Salvar acompanhamento"}
      </Button>
    </div>
  );
}
