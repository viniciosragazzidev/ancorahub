"use client";

/**
 * Visão "Esfriando" de /leads (?view=esfriando, 25/11/2026), o Radar do DeskComm na corretora: leads abertos parados,
 * do mais esquecido para o menos. Nível com texto (Crítico, Em risco) e "Em voo" rebaixado quando há retorno marcado.
 * Clique na linha abre a gaveta do lead. A regra está em `features/leads/cooling-radar.ts`.
 * Diretor, gestor e supervisor têm o ⋯ da linha com Assumir, Cobrar corretor e Redistribuir (26/11/2026); o corretor
 * não vê a coluna. Quem vê o quê vem de `coolingActionsFor`.
 */
import { useMemo } from "react";

import { COOLING_ACTION_LABELS, canRunCoolingActions, coolingActionsFor, type CoolingActionId } from "@/features/leads/cooling-lead-actions-rules";
import {
  COOLING_LEVEL_LABELS,
  classifyCooling,
  formatIdle,
  returnInLabel,
  sortCoolingRows,
  type CoolingInfo,
} from "@/features/leads/cooling-radar";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import a1 from "./leads-1a1.module.css";
import { liteStageLabel } from "./lite-stage-labels";

type Row = { lead: LeadWorkspaceItem; info: CoolingInfo };

const levelTone = (info: CoolingInfo) => (info.level === "critical" ? "danger" : info.level === "at_risk" ? "warning" : "neutral");

export function LeadsLiteCooling({ leads, onOpen, now, actor, onAction }: {
  leads: LeadWorkspaceItem[];
  onOpen: (lead: LeadWorkspaceItem) => void;
  now?: Date;
  /** Quem está vendo: com diretor, gestor ou supervisor a linha ganha o ⋯ com as ações. */
  actor?: { role: string; userId: string };
  onAction?: (lead: LeadWorkspaceItem, action: CoolingActionId, idleMs: number) => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const at = now ?? new Date();
    return sortCoolingRows(leads, (lead) => classifyCooling(lead, at)).map(({ row, info }) => ({ lead: row, info }));
  }, [leads, now]);

  const canAct = Boolean(actor && onAction && canRunCoolingActions(actor.role));
  const levelLabel = (info: CoolingInfo) =>
    info.level === "in_flight" && info.returnInDays ? `${COOLING_LEVEL_LABELS.in_flight} · ${returnInLabel(info.returnInDays)}` : COOLING_LEVEL_LABELS[info.level];
  const actionsOf = (lead: LeadWorkspaceItem) => (actor && canAct ? coolingActionsFor(actor, lead) : []);

  if (rows.length === 0) {
    return (
      <div className={`arc-venancor ${a1.gx}`} data-skin="diretor">
        <section className={`${a1.card} ${a1.empty}`} aria-label="Leads esfriando">
          <p>Nenhum lead esfriando. Todo lead aberto teve atividade no último dia.</p>
        </section>
      </div>
    );
  }

  // Tabela do artifact "Leads da gestão" (27/11/2026): Lead, Corretor, Etapa, Parado há, Nível e as ações à vista
  // (Assumir, Cobrar corretor, Redistribuir) para quem pode agir. No celular, cartões com as mesmas informações.
  return (
    <div className={`arc-venancor ${a1.gx}`} data-skin="diretor">
      <section className={`${a1.card} ${a1.tableCard} ${a1.tableOnly}`} aria-label="Leads esfriando">
        <div className={a1.wide} role="table" aria-label="Leads esfriando">
          <div className={`${a1.coolRow} ${a1.coolHead}`} data-actions={canAct ? "true" : "false"} role="row">
            <span role="columnheader">Lead</span><span role="columnheader">Corretor</span><span role="columnheader">Etapa</span><span role="columnheader">Parado há</span><span role="columnheader">Nível</span>{canAct ? <span role="columnheader">Ações</span> : null}
          </div>
          {rows.map(({ lead, info }) => (
            // Como hoje, tocar na linha abre a gaveta do lead; o nome é o botão para quem usa o teclado.
            <div key={lead.id} role="row" className={a1.coolRow} data-actions={canAct ? "true" : "false"} data-tone={info.level === "in_flight" ? "muted" : undefined} onClick={() => onOpen(lead)} style={{ cursor: "pointer" }}>
              <span role="cell"><button type="button" className={a1.coolName} onClick={(event) => { event.stopPropagation(); onOpen(lead); }}>{lead.nome}</button></span>
              <span role="cell">{lead.corretorNome ?? "Sem corretor"}</span>
              <span role="cell"><span className={a1.badge}>{liteStageLabel(lead.status)}</span></span>
              <span role="cell" className={a1.num}>{formatIdle(info.idleMs)}</span>
              <span role="cell"><span className={a1.badge} data-tone={levelTone(info)}>{levelLabel(info)}</span></span>
              {canAct ? (
                <span role="cell" className={a1.coolActions}>
                  {actionsOf(lead).map((action) => (
                    <button key={action} type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat} ${a1.pillSmall}`} aria-label={`${COOLING_ACTION_LABELS[action]}: ${lead.nome}`} onClick={(event) => { event.stopPropagation(); onAction?.(lead, action, info.idleMs); }}>
                      {COOLING_ACTION_LABELS[action]}
                    </button>
                  ))}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <div className={`${a1.mCards} ${a1.cardsOnly}`} aria-label="Leads esfriando">
        {rows.map(({ lead, info }) => (
          <article key={lead.id} className={`${a1.card} ${a1.mCard}`}>
            <div className={a1.mTop}>
              <button type="button" className={`${a1.coolName} ${a1.mName}`} onClick={() => onOpen(lead)}>{lead.nome}</button>
              <span className={a1.badge} data-tone={levelTone(info)}>{levelLabel(info)}</span>
            </div>
            <p className={a1.mSub}>{lead.corretorNome ?? "Sem corretor"} · {liteStageLabel(lead.status)} · parado há {formatIdle(info.idleMs)}</p>
            {canAct ? (
              <div className={a1.coolActions}>
                {actionsOf(lead).map((action) => (
                  <button key={action} type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat} ${a1.pillSmall}`} onClick={() => onAction?.(lead, action, info.idleMs)}>
                    {COOLING_ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
