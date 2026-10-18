"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { reassignLeadAction, type ManagementActionState } from "@/features/leads/management-actions";
import { Button } from "@/components/ui/button";
import ChipGroup from "@/components/arc/chip-group/chip-group";
import { Textarea } from "@/components/arc/textarea/textarea";

import css from "./handoff-form.module.css";

const AVAILABILITY: Record<string, string> = { available: "Disponível", paused: "Pausado", offline: "Fora do ar" };

/** Choose another broker of the team and say why (the reason goes to the lead history and the audit). */
export function HandoffForm({ lead, brokers }: { lead: { id: string; name: string; ownerName: string }; brokers: { id: string; name: string; availability: string }[] }) {
  const [state, action, pending] = useActionState<ManagementActionState, FormData>(reassignLeadAction, {});
  const [brokerId, setBrokerId] = useState("");
  const [reason, setReason] = useState("");
  const chosen = brokers.find((broker) => broker.id === brokerId);

  if (state.success) {
    return (
      <div className={`arc-venancor ${css.page}`}>
        <div className={css.done}>
          <p className={css.title}>{lead.name} agora está com {chosen?.name ?? "o corretor escolhido"}.</p>
          <p className={css.muted}>O atendimento e o prazo recomeçam para ele, e o motivo ficou no histórico do lead.</p>
          <div className={css.actions}>
            <Link className={css.secondary} href={`/leads/${lead.id}`}>Abrir o lead</Link>
            <Link className={css.primary} href="/leads">Voltar aos leads da equipe</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`arc-venancor ${css.page}`}>
      <form action={action} className={css.form}>
        <input type="hidden" name="leadId" value={lead.id} />
        <input type="hidden" name="brokerId" value={brokerId} />
        <div>
          <h1 className={css.title}>Repassar {lead.name}</h1>
          <p className={css.muted}>Hoje com {lead.ownerName}. Escolha outro corretor da sua equipe.</p>
        </div>

        {brokers.length ? (
          <div className={css.brokerPicker}>
            <ChipGroup label="Corretor que vai receber" multiple={false} options={brokers.map((broker) => ({ value: broker.id, label: broker.name }))} value={brokerId ? [brokerId] : []} onValueChange={(values) => setBrokerId(values[0] ?? "")} />
            {chosen ? <p className={css.muted}>{AVAILABILITY[chosen.availability] ?? chosen.availability}</p> : null}
          </div>
        ) : (
          <p className={css.empty}>Ninguém mais na sua equipe pode receber este lead.</p>
        )}

        <div className={css.field}>
          <Textarea label="Motivo do repasse" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={3} placeholder="Ex.: corretor fora do plantão, cliente sem resposta há 1 hora" />
        </div>

        {state.error ? <p role="alert" className={css.error}>{state.error}</p> : null}

        <Button type="submit" disabled={pending || !brokerId || reason.trim().length < 5} loading={pending}>
          {pending ? "Repassando..." : chosen ? `Repassar para ${chosen.name.split(" ")[0]}` : "Repassar"}
        </Button>
      </form>
    </div>
  );
}
