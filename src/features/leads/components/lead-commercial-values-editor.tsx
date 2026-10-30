"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { updateLeadCommercialValuesAction, type CommercialValuesActionState } from "@/features/leads/commercial-values-actions";
import { formatCurrency } from "@/features/quotes/utils";

export function LeadCommercialValuesEditor({
  leadId,
  monthlyValue,
  livesCount,
  lockedSource,
  onSaved,
}: {
  leadId: string;
  monthlyValue?: string | null;
  livesCount?: number | null;
  lockedSource?: "sale" | "proposal" | null;
  onSaved?: (values: { monthlyValue: string | null; livesCount: number | null }) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CommercialValuesActionState, FormData>(updateLeadCommercialValuesAction, {});

  useEffect(() => {
    if (!state.success) return;
    onSaved?.({ monthlyValue: state.monthlyValue ?? null, livesCount: state.livesCount ?? null });
    router.refresh();
  }, [state.success, state.monthlyValue, state.livesCount, onSaved, router]);

  if (lockedSource) {
    return (
      <div className="space-y-1 rounded-(--radius-control) bg-muted/40 p-3 text-sm" role="note">
        <p className="font-medium">Valor preservado da {lockedSource === "sale" ? "venda ativa" : "proposta ativa"}</p>
        <p className="tabular-nums text-muted-foreground">
          {monthlyValue == null ? "Valor mensal não informado" : formatCurrency(Number(monthlyValue))}
          {livesCount ? ` · ${livesCount} ${livesCount === 1 ? "vida" : "vidas"}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Edite a venda ou proposta de origem para alterar este total.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3" aria-label="Editar valor mensal e vidas">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Input label="Valor mensal (R$)" name="monthlyValue" type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01" defaultValue={monthlyValue ?? ""} placeholder="0,00" className="min-h-11" />
        </div>
        <div className="min-w-0">
          <Input label="Vidas" name="livesCount" type="number" inputMode="numeric" min="1" max="100" step="1" defaultValue={livesCount ?? ""} placeholder="1" className="min-h-11" />
        </div>
      </div>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-success">Dados salvos.</p> : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-full">
        {pending ? "Salvando…" : "Salvar valor e vidas"}
      </Button>
    </form>
  );
}
