"use client";

/**
 * Visão "Esfriando" de /leads (?view=esfriando, 25/11/2026), o Radar do DeskComm na corretora: leads abertos parados,
 * do mais esquecido para o menos. Nível com texto (Crítico, Em risco) e "Em voo" rebaixado quando há retorno marcado.
 * Clique na linha abre a gaveta do lead. A regra está em `features/leads/cooling-radar.ts`.
 */
import { useMemo } from "react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import {
  COOLING_LEVEL_LABELS,
  classifyCooling,
  formatIdle,
  returnInLabel,
  sortCoolingRows,
  type CoolingInfo,
} from "@/features/leads/cooling-radar";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import styles from "./leads-lite-list.module.css";
import { liteStageLabel } from "./lite-stage-labels";

type Row = { lead: LeadWorkspaceItem; info: CoolingInfo };

const levelTone = (info: CoolingInfo) => (info.level === "critical" ? "danger" : info.level === "at_risk" ? "warning" : "neutral");

export function LeadsLiteCooling({ leads, onOpen, now }: { leads: LeadWorkspaceItem[]; onOpen: (lead: LeadWorkspaceItem) => void; now?: Date }) {
  const rows = useMemo<Row[]>(() => {
    const at = now ?? new Date();
    return sortCoolingRows(leads, (lead) => classifyCooling(lead, at)).map(({ row, info }) => ({ lead: row, info }));
  }, [leads, now]);

  const columns: LiteColumn<Row>[] = [
    { id: "lead", label: "Lead", primary: true, render: ({ lead }) => lead.nome },
    { id: "owner", label: "Corretor", nowrap: true, secondary: true, render: ({ lead }) => lead.corretorNome ?? "Sem corretor" },
    { id: "stage", label: "Etapa", render: ({ lead }) => liteStageLabel(lead.status) },
    { id: "idle", label: "Parado há", numeric: true, render: ({ info }) => formatIdle(info.idleMs) },
    {
      id: "level",
      label: "Nível",
      render: ({ info }) => (
        <span className={styles.badge} data-tone={levelTone(info)}>
          {info.level === "in_flight" && info.returnInDays ? `${COOLING_LEVEL_LABELS.in_flight} · ${returnInLabel(info.returnInDays)}` : COOLING_LEVEL_LABELS[info.level]}
        </span>
      ),
    },
  ];

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <LiteResponsiveData
        caption="Leads esfriando"
        columns={columns}
        rows={rows}
        rowKey={({ lead }) => lead.id}
        onRowOpen={({ lead }) => onOpen(lead)}
        rowTone={({ info }) => (info.level === "in_flight" ? "muted" : undefined)}
        empty={<p>Nenhum lead esfriando. Todo lead aberto teve atividade no último dia.</p>}
      />
    </div>
  );
}
