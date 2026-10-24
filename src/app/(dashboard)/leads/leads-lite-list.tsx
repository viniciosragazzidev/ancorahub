"use client";

/**
 * Lista de /leads no visual Lite (chave ligada): tabela a partir de 768px e cartões abaixo. As mesmas colunas da
 * tabela atual (lead, telefone, etapa, origem, corretor, unidade e chegada), sem a origem para o corretor, e a
 * mesma abertura de linha. Só muda a apresentação.
 */
import { useMemo } from "react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsDataTable, type LeadsDataTableProps } from "./leads-data-table";
import styles from "./leads-lite-list.module.css";

const chegada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function LeadsLiteList({ leads, contextRole, onRowClick }: {
  leads: LeadWorkspaceItem[];
  contextRole?: string;
  onRowClick?: (lead: LeadWorkspaceItem) => void;
}) {
  const hideOrigin = contextRole === "broker";
  const columns = useMemo<LiteColumn<LeadWorkspaceItem>[]>(() => {
    const base: LiteColumn<LeadWorkspaceItem>[] = [
      { id: "lead", label: "Lead", render: (lead) => lead.nome, primary: true },
      { id: "phone", label: "Telefone", render: (lead) => lead.telefone, secondary: true },
      { id: "stage", label: "Etapa", render: (lead) => (LEAD_STATUS_LABELS as Record<string, string>)[lead.status] ?? lead.status },
    ];
    if (!hideOrigin) base.push({ id: "origin", label: "Origem", render: (lead) => lead.origem });
    base.push(
      { id: "broker", label: "Corretor", render: (lead) => lead.corretorNome ?? "Sem corretor" },
      { id: "branch", label: "Unidade", render: (lead) => lead.branchName ?? "Sem unidade" },
      { id: "arrival", label: "Chegada", render: (lead) => chegada.format(new Date(lead.createdAt)), numeric: true },
    );
    return base;
  }, [hideOrigin]);

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <LiteResponsiveData
        caption="Leads"
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead.id}
        onRowOpen={onRowClick}
        empty={<p>Nenhum lead neste filtro.</p>}
      />
    </div>
  );
}

/** Escolhe a lista da tela: a Lite com a chave do painel do diretor ligada; a tabela atual nos demais casos. */
export function LeadsListSwitch(props: LeadsDataTableProps) {
  const lite = useArcScopeEnabled();
  if (!lite) return <LeadsDataTable {...props} />;
  return <LeadsLiteList leads={props.leads} contextRole={props.contextRole} onRowClick={props.onRowClick} />;
}
