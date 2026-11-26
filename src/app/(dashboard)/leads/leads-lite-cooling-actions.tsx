"use client";

/**
 * Ações da visão "Esfriando" (26/11/2026): Assumir, Cobrar corretor e Redistribuir, no ⋯ da linha (abre o painel
 * lateral com a ação) e na gaveta do lead. Quem vê cada ação vem de `coolingActionsFor` (corretor não vê nenhuma);
 * o escopo de verdade é checado no servidor (`features/leads/cooling-lead-actions.ts`).
 *
 * Feedback nível 1 (FEEDBACK.md): LiteActionButton com repouso, enviando, confirmado e falhou; o sucesso só depois
 * do servidor; a falha mostra a causa, o que continua valendo e "Tentar de novo".
 */
import { useEffect, useState } from "react";

import { LiteActionButton, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { formatIdle } from "@/features/leads/cooling-radar";
import {
  assumeCoolingLeadAction,
  listCoolingRedistributeOptionsAction,
  nudgeCoolingBrokerAction,
  redistributeCoolingLeadAction,
  type CoolingBrokerOption,
} from "@/features/leads/cooling-lead-actions";
import { COOLING_ACTION_LABELS, NUDGE_TASK_PREFIX, type CoolingActionId } from "@/features/leads/cooling-lead-actions-rules";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

export type CoolingActionCommit = { leadId: string; action: CoolingActionId; corretorId?: string | null; corretorNome?: string | null };

type BodyProps = {
  lead: LeadWorkspaceItem;
  idleMs: number | null;
  tone?: "primary" | "secondary";
  onCommitted: (commit: CoolingActionCommit) => void;
};

const idleText = (idleMs: number | null) => (idleMs === null ? "" : ` Parado há ${formatIdle(idleMs)}.`);

function AssumeBody({ lead, idleMs, tone = "primary", onCommitted }: BodyProps) {
  return (
    <div className={form.form}>
      <p className={sections.note}>
        {lead.corretorNome ? `O lead passa para você e ${lead.corretorNome} deixa de ser o responsável.` : "O lead passa para você."}
        {idleText(idleMs)}
      </p>
      <div className={form.actions}>
        <LiteActionButton
          tone={tone}
          busyLabel="Assumindo…"
          doneLabel="Lead é seu"
          keeps={lead.corretorNome ? `O lead continua com ${lead.corretorNome}.` : "O lead continua como estava."}
          errorFallback="Não consegui assumir o lead agora."
          onAction={async () => {
            const result = await assumeCoolingLeadAction(lead.id);
            if (!result.ok) return result;
            onCommitted({ leadId: lead.id, action: "assume", corretorId: result.corretorId ?? null });
            return { ok: true };
          }}
        >
          Assumir lead
        </LiteActionButton>
      </div>
    </div>
  );
}

function NudgeBody({ lead, idleMs, tone = "primary", onCommitted }: BodyProps) {
  return (
    <div className={form.form}>
      <p className={sections.note}>
        {`${lead.corretorNome ?? "O corretor"} recebe a tarefa "${NUDGE_TASK_PREFIX} ${lead.nome}", com prazo de 2 horas.`}
        {idleText(idleMs)}
      </p>
      <div className={form.actions}>
        <LiteActionButton
          tone={tone}
          busyLabel="Cobrando…"
          doneLabel="Corretor cobrado"
          keeps="Nenhuma tarefa foi criada."
          errorFallback="Não consegui cobrar o corretor agora."
          onAction={async () => {
            const result = await nudgeCoolingBrokerAction(lead.id);
            if (!result.ok) return result;
            onCommitted({ leadId: lead.id, action: "nudge" });
            return { ok: true };
          }}
        >
          Cobrar corretor
        </LiteActionButton>
      </div>
    </div>
  );
}

type Options = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; brokers: CoolingBrokerOption[]; onDuty: boolean };

function RedistributeBody({ lead, idleMs, tone = "primary", onCommitted }: BodyProps) {
  const [options, setOptions] = useState<Options>({ status: "loading" });
  const [brokerId, setBrokerId] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setOptions({ status: "loading" });
    listCoolingRedistributeOptionsAction(lead.id)
      .then((result) => {
        if (!current) return;
        setOptions(result.ok ? { status: "ready", brokers: result.brokers, onDuty: result.onDuty } : { status: "error", message: result.message });
      })
      .catch(() => { if (current) setOptions({ status: "error", message: "Não consegui carregar os corretores agora." }); });
    return () => { current = false; };
  }, [lead.id, attempt]);

  if (options.status === "loading") return <p className={sections.note} role="status">Carregando corretores…</p>;
  if (options.status === "error") {
    return (
      <div className={form.form}>
        <p className={sections.error} role="alert">{options.message}</p>
        <div className={form.actions}>
          <button type="button" className={page.button} onClick={() => setAttempt((value) => value + 1)}>Tentar de novo</button>
        </div>
      </div>
    );
  }
  const broker = options.brokers.find((item) => item.id === brokerId);
  if (!options.brokers.length) {
    return <p className={sections.note}>{options.onDuty ? "Nenhum outro corretor no plantão ativo desta fila." : "Nenhum outro corretor ativo na unidade do lead."}</p>;
  }
  return (
    <div className={form.form}>
      <p className={sections.note}>
        {options.onDuty ? "Escolha um corretor do plantão ativo. O atendimento recomeça com ele." : "Escolha um corretor da unidade. O atendimento recomeça com ele."}
        {idleText(idleMs)}
      </p>
      <LiteSelect
        label="Novo corretor"
        value={brokerId}
        onChange={setBrokerId}
        placeholder="Escolha o corretor"
        searchPlaceholder="Buscar corretor"
        options={options.brokers.map((item) => ({ value: item.id, label: item.name }))}
      />
      <div className={form.actions}>
        <LiteActionButton
          key={brokerId}
          tone={tone}
          busyLabel="Redistribuindo…"
          doneLabel="Redistribuído"
          disabled={!broker}
          keeps={lead.corretorNome ? `O lead continua com ${lead.corretorNome}.` : "O lead continua como estava."}
          errorFallback="Não consegui redistribuir o lead agora."
          onAction={async () => {
            if (!broker) return { ok: false, message: "Escolha o corretor." };
            const result = await redistributeCoolingLeadAction({ leadId: lead.id, brokerId: broker.id, dutyScheduleId: broker.scheduleId ?? null });
            if (!result.ok) return result;
            onCommitted({ leadId: lead.id, action: "redistribute", corretorId: result.corretorId ?? broker.id, corretorNome: result.corretorNome ?? broker.name });
            return { ok: true };
          }}
        >
          Redistribuir
        </LiteActionButton>
      </div>
    </div>
  );
}

export function CoolingActionBody({ action, ...props }: BodyProps & { action: CoolingActionId }) {
  if (action === "assume") return <AssumeBody {...props} />;
  if (action === "nudge") return <NudgeBody {...props} />;
  return <RedistributeBody {...props} />;
}

/** Painel aberto pelo ⋯ da linha: uma ação, um botão primário. */
export function CoolingActionPanel({ target, onClose, onCommitted }: {
  target: { lead: LeadWorkspaceItem; action: CoolingActionId; idleMs: number | null } | null;
  onClose: () => void;
  onCommitted: (commit: CoolingActionCommit) => void;
}) {
  return (
    <LiteSidePanel
      open={Boolean(target)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={target ? `${COOLING_ACTION_LABELS[target.action]}: ${target.lead.nome}` : "Lead parado"}
      description={target?.lead.corretorNome ? `Com ${target.lead.corretorNome}` : target ? "Sem corretor" : undefined}
    >
      {target ? <CoolingActionBody key={`${target.lead.id}:${target.action}`} action={target.action} lead={target.lead} idleMs={target.idleMs} onCommitted={onCommitted} /> : null}
    </LiteSidePanel>
  );
}

/** Na gaveta do lead parado: as mesmas ações, escolhidas numa linha de botões; o botão da ação é de apoio. */
export function CoolingDrawerActions({ lead, actions, idleMs, onCommitted }: {
  lead: LeadWorkspaceItem;
  actions: CoolingActionId[];
  idleMs: number | null;
  onCommitted: (commit: CoolingActionCommit) => void;
}) {
  const [action, setAction] = useState<CoolingActionId | null>(null);
  if (!actions.length) return null;
  return (
    <section className="arc-venancor" aria-labelledby={`cooling-actions-${lead.id}`}>
      <div className={sections.group}>
        <div className={sections.row}>
          <div className={sections.rowText}>
            <h3 id={`cooling-actions-${lead.id}`} className={sections.rowTitle}>Lead parado</h3>
            <p className={sections.rowDescription}>{idleMs === null ? "Sem atividade recente." : `Parado há ${formatIdle(idleMs)}.`}</p>
          </div>
        </div>
        <div className={sections.formBody}>
          <div role="group" aria-label="Ações do lead parado" className={page.countTabs}>
            {actions.map((id) => (
              <button key={id} type="button" className={page.countTab} data-active={action === id ? "true" : undefined} aria-pressed={action === id} onClick={() => setAction(id)}>
                {COOLING_ACTION_LABELS[id]}
              </button>
            ))}
          </div>
          {action ? <CoolingActionBody key={`${lead.id}:${action}`} action={action} lead={lead} idleMs={idleMs} tone="secondary" onCommitted={onCommitted} /> : null}
        </div>
      </div>
    </section>
  );
}
