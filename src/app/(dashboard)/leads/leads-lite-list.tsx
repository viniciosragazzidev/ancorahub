"use client";

/**
 * Lista de /leads no visual Lite (chave ligada): cabeçalho (busca, contagem e alternar lista/kanban), tabela a partir
 * de 768px e cartões abaixo. As mesmas colunas da tabela atual, a etapa como badge e as ações da linha (abrir drawer,
 * página completa e WhatsApp) num menu. Seleção em massa com a barra de lote (`LeadsLiteBulk`). A busca fica nos
 * filtros Lite (`LeadsLiteFilters`), que preservam os demais parâmetros da URL.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteMenu, type LiteMenuItem } from "@/components/lite/controls";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
import { openWhatsApp } from "@/lib/whatsapp-open";

import { LeadsDataTable, type LeadsDataTableProps } from "./leads-data-table";
import { LeadsLiteBulk, type LeadsLiteBulkConfig } from "./leads-lite-bulk";
import styles from "./leads-lite-list.module.css";

const chegada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Tom da etapa: fechada com ganho em verde, perda em vermelho, o resto neutro. */
function stageTone(status: string): "neutral" | "success" | "danger" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  return "neutral";
}

export function LeadsLiteList({ leads, contextRole, onRowClick, view = "list", total, selectedIds, onToggleRow, onSelectAll, isAllSelected = false, bulk }: {
  leads: LeadWorkspaceItem[];
  contextRole?: string;
  onRowClick?: (lead: LeadWorkspaceItem) => void;
  /** Visão atual: "list" ou "kanban". O kanban ainda é o da tela atual. */
  view?: "list" | "kanban";
  /** Total de leads no filtro (contagem do cabeçalho). Padrão: a quantidade recebida. */
  total?: number;
  /** Seleção em massa do workspace (mesmo estado da tela atual). Sem `onToggleRow`, a lista não tem caixas. */
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onSelectAll?: (checked: boolean) => void;
  isAllSelected?: boolean;
  /** Ações em lote (papel, corretores, unidades e retornos). Sem isto, a barra mostra só o que vale para todos. */
  bulk?: LeadsLiteBulkConfig;
}) {
  const hideOrigin = contextRole === "broker";
  const columns = useMemo<LiteColumn<LeadWorkspaceItem>[]>(() => {
    const base: LiteColumn<LeadWorkspaceItem>[] = [
      { id: "lead", label: "Lead", render: (lead) => lead.nome, primary: true },
      { id: "phone", label: "Telefone", render: (lead) => lead.telefone, secondary: true },
      {
        id: "stage",
        label: "Etapa",
        render: (lead) => (
          <span className={styles.badge} data-tone={stageTone(lead.status)}>
            {(LEAD_STATUS_LABELS as Record<string, string>)[lead.status] ?? lead.status}
          </span>
        ),
      },
    ];
    if (!hideOrigin) base.push({ id: "origin", label: "Origem", render: (lead) => lead.origem });
    base.push(
      { id: "broker", label: "Corretor", render: (lead) => lead.corretorNome ?? "Sem corretor" },
      { id: "branch", label: "Unidade", render: (lead) => lead.branchName ?? "Sem unidade" },
      { id: "arrival", label: "Chegada", render: (lead) => chegada.format(new Date(lead.createdAt)), numeric: true },
      {
        id: "actions",
        label: "Ações",
        numeric: true,
        render: (lead) => <LiteMenu label={`Ações de ${lead.nome}`} items={rowActions(lead, onRowClick)} />,
      },
    );
    return base;
  }, [hideOrigin, onRowClick]);

  const count = total ?? leads.length;
  const selected = useMemo(() => selectedIds ?? [], [selectedIds]);
  const selection = onToggleRow
    ? {
        isSelected: (lead: LeadWorkspaceItem) => selected.includes(lead.id),
        onToggle: (lead: LeadWorkspaceItem) => onToggleRow(lead.id),
        allSelected: isAllSelected,
        onToggleAll: (checked: boolean) => onSelectAll?.(checked),
        rowLabel: (lead: LeadWorkspaceItem) => `Selecionar ${lead.nome}`,
      }
    : undefined;
  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <div className={styles.head}>
        <p className={styles.count} aria-live="polite">{count} {count === 1 ? "lead" : "leads"}</p>
        <nav aria-label="Visão" className={styles.views}>
          <Link href="/leads" className={styles.viewLink} aria-current={view === "list" ? "page" : undefined}>Lista</Link>
          <Link href="/leads?view=kanban" className={styles.viewLink} aria-current={view === "kanban" ? "page" : undefined}>Kanban</Link>
        </nav>
      </div>
      <LiteResponsiveData
        caption="Leads"
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead.id}
        onRowOpen={onRowClick}
        empty={<p>Nenhum lead neste filtro.</p>}
        selection={selection}
      />
      {selection ? (
        <LeadsLiteBulk selectedIds={selected} onClear={() => onSelectAll?.(false)} config={bulk ?? { role: contextRole, brokers: [], branches: [] }} />
      ) : null}
    </div>
  );
}

/** As mesmas ações de hoje: drawer de gestão, página completa e WhatsApp (quando há telefone). */
function rowActions(lead: LeadWorkspaceItem, onOpen?: (lead: LeadWorkspaceItem) => void): LiteMenuItem[] {
  const items: LiteMenuItem[] = [];
  if (onOpen) items.push({ id: "drawer", label: "Abrir drawer de gestão", onSelect: () => onOpen(lead) });
  items.push({ id: "page", label: "Abrir página completa", href: `/leads/${lead.id}` });
  const digits = lead.telefone.replace(/\D/g, "");
  if (digits) items.push({ id: "whatsapp", label: "Abrir no WhatsApp", tone: "success", onSelect: () => openWhatsApp(buildWhatsAppWebUrl(digits)) });
  return items;
}

/** Escolhe a lista da tela: a Lite com a chave do painel do diretor ligada; a tabela atual nos demais casos. */
export function LeadsListSwitch({ liteBulk, ...props }: LeadsDataTableProps & { liteBulk?: LeadsLiteBulkConfig }) {
  const lite = useArcScopeEnabled();
  const params = useSearchParams();
  if (!lite) return <LeadsDataTable {...props} />;
  return (
    <LeadsLiteList
      leads={props.leads}
      contextRole={props.contextRole}
      onRowClick={props.onRowClick}
      view={params.get("view") === "kanban" ? "kanban" : "list"}
      selectedIds={Array.isArray(props.selectedIds) ? props.selectedIds : props.selectedIds instanceof Set ? [...props.selectedIds] : undefined}
      onToggleRow={props.onToggleRow}
      onSelectAll={props.onSelectAll}
      isAllSelected={props.isAllSelected}
      bulk={liteBulk}
    />
  );
}
