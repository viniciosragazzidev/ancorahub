"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { reassignLeadAction, type ManagementActionState } from "@/features/leads/management-actions";

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
            <Link className={css.primary} href="/dashboard/c/equipe-leads">Voltar aos leads da equipe</Link>
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
          <ul className={css.list} role="radiogroup" aria-label="Corretor que vai receber">
            {brokers.map((broker) => (
              <li key={broker.id}>
                <button type="button" role="radio" aria-checked={brokerId === broker.id} className={`${css.option} ${brokerId === broker.id ? css.optionOn : ""}`} onClick={() => setBrokerId(broker.id)}>
                  <span className={css.optionName}>{broker.name}</span>
                  <span className={css.muted}>{AVAILABILITY[broker.availability] ?? broker.availability}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={css.empty}>Ninguém mais na sua equipe pode receber este lead.</p>
        )}

        <label className={css.field}>
          <span className={css.label}>Motivo do repasse</span>
          <textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} rows={3} className={css.textarea} placeholder="Ex.: corretor fora do plantão, cliente sem resposta há 1 hora" />
        </label>

        {state.error ? <p role="alert" className={css.error}>{state.error}</p> : null}

        <button type="submit" className={css.primary} disabled={pending || !brokerId || reason.trim().length < 5}>
          {pending ? "Repassando..." : chosen ? `Repassar para ${chosen.name.split(" ")[0]}` : "Repassar"}
        </button>
      </form>
    </div>
  );
}
