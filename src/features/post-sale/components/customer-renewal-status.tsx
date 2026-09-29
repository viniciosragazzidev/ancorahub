"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
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
        <AppSelect
          aria-label="Andamento da renovação"
          disabled={disabled || pending}
          id={`renewal-status-${activeCustomerId}`}
          onValueChange={(value) => setStatus(value as RenewalStatus)}
          options={renewalOptions.map((option) => ({ value: option.value, label: option.label }))}
          triggerClassName="h-9 w-full bg-background text-sm shadow-xs"
          value={status}
        />
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
