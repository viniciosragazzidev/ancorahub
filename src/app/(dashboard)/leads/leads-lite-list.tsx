"use client";

/**
 * Lista de /leads no visual Lite (chave ligada): cabeçalho (busca, contagem e alternar lista/kanban), tabela a partir
 * de 768px e cartões abaixo. As mesmas colunas da tabela atual, a etapa como badge e as ações da linha (abrir drawer,
 * página completa e WhatsApp) num menu. Filtros e lote ficam para a próxima etapa.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Search } from "lucide-react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteMenu, type LiteMenuItem } from "@/components/lite/controls";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
import { openWhatsApp } from "@/lib/whatsapp-open";

import { LeadsDataTable, type LeadsDataTableProps } from "./leads-data-table";
import styles from "./leads-lite-list.module.css";

const chegada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Tom da etapa: fechada com ganho em verde, perda em vermelho, o resto neutro. */
function stageTone(status: string): "neutral" | "success" | "danger" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  return "neutral";
}

export function LeadsLiteList({ leads, contextRole, onRowClick, search = "", view = "list", total }: {
  leads: LeadWorkspaceItem[];
  contextRole?: string;
  onRowClick?: (lead: LeadWorkspaceItem) => void;
  /** Texto da busca atual (parâmetro `search` da URL). */
  search?: string;
  /** Visão atual: "list" ou "kanban". O kanban ainda é o da tela atual. */
  view?: "list" | "kanban";
  /** Total de leads no filtro (contagem do cabeçalho). Padrão: a quantidade recebida. */
  total?: number;
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
  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <div className={styles.head}>
        <form role="search" action="/leads" method="get" className={styles.search}>
          <Search aria-hidden="true" size={18} className={styles.searchIcon} />
          <input type="search" name="search" defaultValue={search} placeholder="Buscar lead" aria-label="Buscar lead por nome ou telefone" className={styles.searchInput} />
          {view === "kanban" ? <input type="hidden" name="view" value="kanban" /> : null}
        </form>
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
      />
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
export function LeadsListSwitch(props: LeadsDataTableProps) {
  const lite = useArcScopeEnabled();
  const params = useSearchParams();
  if (!lite) return <LeadsDataTable {...props} />;
  return (
    <LeadsLiteList
      leads={props.leads}
      contextRole={props.contextRole}
      onRowClick={props.onRowClick}
      search={params.get("search") ?? ""}
      view={params.get("view") === "kanban" ? "kanban" : "list"}
    />
  );
}
