"use client";

import { useActionState } from "react";
import Link from "next/link";
import { reassignLeadAction, type ManagementActionState } from "@/features/leads/management-actions";
import { Button } from "@/components/ui/button";

export function ManagerLeadTransferForm({ leadId, leadName, brokers }: { leadId: string; leadName: string; brokers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ManagementActionState, FormData>(reassignLeadAction, {});
  if (state.success) return <section aria-live="polite"><p>{state.message ?? `${leadName} foi repassado.`}</p><Link href="/leads">Voltar aos leads da unidade</Link></section>;
  return <form action={action} className="grid gap-3" aria-label={`Repassar ${leadName}`}>
    <input type="hidden" name="leadId" value={leadId} />
    <label className="grid gap-1 text-sm font-medium">Repassar para
      <select name="brokerId" required defaultValue="" className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="" disabled>Escolha um corretor da unidade</option>
        {brokers.filter((broker) => broker.id !== "").map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}
      </select>
    </label>
    {state.needsAssignmentMode ? <div className="flex flex-wrap gap-2" aria-label="Como repassar">
      <Button type="submit" name="assignmentMode" value="direct" disabled={pending}>Atribuir direto</Button>
      <Button type="submit" name="assignmentMode" value="offer" variant="outline" disabled={pending}>Enviar oferta</Button>
    </div> : <Button type="submit" disabled={pending || brokers.length === 0}>{pending ? "Repassando…" : "Repassar lead"}</Button>}
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {!brokers.length ? <p className="text-sm text-muted-foreground">Não há corretores ativos nesta unidade.</p> : null}
  </form>;
}
