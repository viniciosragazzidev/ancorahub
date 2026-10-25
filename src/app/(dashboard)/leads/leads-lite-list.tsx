"use client";

/**
 * Lista de /leads no visual Lite (chave ligada e rota fora do opt-out): tabela a partir de 768px e cartões abaixo,
 * paginação pela URL (`?page`, como a tabela atual) com o total do filtro. A troca de visão é a barra do workspace,
 * na mesma linha da busca e dos filtros. As informações da tabela atual: etiquetas, entrada pelo WhatsApp, etapa, fila,
 * qualificação, corretor com plantão, investigação e devolução sem aceite (com destaque da linha), unidade e chegada.
 * Ações da linha num menu; seleção em massa com a barra de lote. A busca fica nos filtros Lite.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination } from "@/components/lite/data/pagination";
import { LiteMenu, type LiteMenuItem } from "@/components/lite/controls";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";
import { LEAD_QUALIFICATION_LABELS, type LeadQualificationStatus } from "@/features/leads/qualification-status";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
import { openWhatsApp } from "@/lib/whatsapp-open";

import { LeadsDataTable, QualifyingLeadsDataTable, type LeadsDataTableProps, type QualifyingLeadsDataTableProps } from "./leads-data-table";
import { LeadsLiteBulk, type LeadsLiteBulkConfig } from "./leads-lite-bulk";
import styles from "./leads-lite-list.module.css";
import { liteStageLabel } from "./lite-stage-labels";

const chegada = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Tone = "success" | "warning" | "neutral" | "danger";

/** Qualificação da IA como na tabela atual (alta, média, baixa aptidão e desqualificado), em sentence case. */
const QUALIFICATION: Record<string, { label: string; tone: Tone }> = {
  alta: { label: "Alta aptidão", tone: "success" },
  high: { label: "Alta aptidão", tone: "success" },
  hot: { label: "Alta aptidão", tone: "success" },
  quente: { label: "Alta aptidão", tone: "success" },
  media: { label: "Média aptidão", tone: "warning" },
  medium: { label: "Média aptidão", tone: "warning" },
  warm: { label: "Média aptidão", tone: "warning" },
  morno: { label: "Média aptidão", tone: "warning" },
  baixa: { label: "Baixa aptidão", tone: "neutral" },
  low: { label: "Baixa aptidão", tone: "neutral" },
  cold: { label: "Baixa aptidão", tone: "neutral" },
  frio: { label: "Baixa aptidão", tone: "neutral" },
  unqualified: { label: "Desqualificado", tone: "danger" },
  desqualificado: { label: "Desqualificado", tone: "danger" },
};

function qualificationOf(status: string | null | undefined): { label: string; tone: Tone } | null {
  if (!status) return null;
  const known = QUALIFICATION[status.toLowerCase()];
  if (known) return known;
  const label = LEAD_QUALIFICATION_LABELS[status as LeadQualificationStatus] ?? status;
  return { label: label.charAt(0) + label.slice(1).toLowerCase(), tone: "neutral" };
}

/** Destaque da linha como na tabela atual: investigação da gestão em cinza, devolvido sem aceite em atenção. */
function rowTone(lead: LeadWorkspaceItem): "warning" | "muted" | undefined {
  if (lead.isManagementInvestigation) return "muted";
  if (lead.returnedUnaccepted) return "warning";
  return undefined;
}

/** Tom da etapa: fechada com ganho em verde, perda em vermelho, o resto neutro. */
function stageTone(status: string): Tone {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  return "neutral";
}

type Pagination = { currentPage?: number; pageSize?: number; totalItems?: number; totalPages?: number };

export function LeadsLiteList({
  leads, contextRole, onRowClick, pagination, onPageChange, pagePending = false,
  selectedIds, onToggleRow, onSelectAll, isAllSelected = false, bulk,
}: {
  leads: LeadWorkspaceItem[];
  contextRole?: string;
  onRowClick?: (lead: LeadWorkspaceItem) => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  pagePending?: boolean;
  /** Seleção em massa do workspace (mesmo estado da tela atual). Sem `onToggleRow`, a lista não tem caixas. */
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onSelectAll?: (checked: boolean) => void;
  isAllSelected?: boolean;
  /** Ações em lote (papel, corretores, unidades e retornos). Sem isto, a barra mostra só o que vale para todos. */
  bulk?: LeadsLiteBulkConfig;
}) {
  const isBroker = contextRole === "broker";
  const columns = useMemo<LiteColumn<LeadWorkspaceItem>[]>(() => {
    const base: LiteColumn<LeadWorkspaceItem>[] = [
      { id: "lead", label: "Lead", render: (lead) => <LeadName lead={lead} hideEntry={isBroker} />, primary: true },
      { id: "phone", label: "Telefone", render: (lead) => <span className={styles.nowrap}>{formatLeadPhone(lead.telefone)}</span>, secondary: true },
      {
        id: "stage",
        label: "Etapa",
        render: (lead) => <span className={styles.badge} data-tone={stageTone(lead.status)}>{liteStageLabel(lead.status)}</span>,
      },
      {
        id: "queue",
        label: "Fila",
        render: (lead) => lead.queueName
          ? <span className={styles.queue}><QueueColorDot hue={lead.queueColorHue} /><span className={styles.ellipsis}>{lead.queueName}</span></span>
          : <span className={styles.muted}>Sem fila</span>,
      },
      {
        id: "qualification",
        label: "Qualificação",
        render: (lead) => {
          const qualification = qualificationOf(lead.qualificationStatus);
          return qualification
            ? <span className={styles.badge} data-tone={qualification.tone}>{qualification.label}</span>
            : <span className={styles.muted}>Sem qualificação</span>;
        },
      },
    ];
    if (!isBroker) base.push({ id: "origin", label: "Origem", render: (lead) => lead.origem });
    base.push(
      { id: "broker", label: "Corretor e unidade", render: (lead) => <BrokerCell lead={lead} /> },
    );
    // Como na tabela atual, o corretor não vê a chegada do lead.
    if (!isBroker) base.push({ id: "arrival", label: "Chegada", render: (lead) => chegada.format(new Date(lead.createdAt)), numeric: true });
    base.push({
      id: "actions",
      label: "Ações",
      numeric: true,
      render: (lead) => <LiteMenu label={`Ações de ${lead.nome}`} items={rowActions(lead, onRowClick)} />,
    });
    return base;
  }, [isBroker, onRowClick]);

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
      <LiteResponsiveData
        caption="Leads"
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead.id}
        onRowOpen={onRowClick}
        empty={<p>Nenhum lead neste filtro.</p>}
        selection={selection}
        rowTone={rowTone}
      />
      {pagination && onPageChange ? (
        <LitePagination
          label="Páginas de leads"
          page={pagination.currentPage ?? 1}
          totalPages={pagination.totalPages ?? 1}
          totalItems={pagination.totalItems ?? leads.length}
          pageSize={pagination.pageSize ?? (leads.length || 20)}
          onPageChange={onPageChange}
          pending={pagePending}
        />
      ) : null}
      {selection ? (
        <LeadsLiteBulk selectedIds={selected} onClear={() => onSelectAll?.(false)} config={bulk ?? { role: contextRole, brokers: [], branches: [] }} />
      ) : null}
    </div>
  );
}

/** Até 2 etiquetas e "+N" (com os nomes no title): nunca passa de 2 linhas no cartão nem na tabela. */
const MAX_TAGS = 2;

/**
 * Nome (até 2 linhas, quebra só nos espaços, reticências e nome inteiro no title), e embaixo a entrada pelo WhatsApp e
 * as etiquetas, como na tabela atual.
 */
function LeadName({ lead, hideEntry }: { lead: LeadWorkspaceItem; hideEntry: boolean }) {
  const entry = hideEntry ? null : readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
  const tags = lead.tags ?? [];
  const whatsapp = entry?.entry === "whatsapp";
  return (
    <span className={styles.leadCell}>
      <span className={styles.leadName} title={lead.nome}>{lead.nome}</span>
      {whatsapp || tags.length ? (
        <span className={styles.tags}>
          {whatsapp ? (
            <span className={styles.tag} title={entry?.adsLabel ? `Entrou pelo WhatsApp: ${entry.adsLabel}` : "Entrou pelo WhatsApp"}>WhatsApp</span>
          ) : null}
          {tags.slice(0, MAX_TAGS).map((tag) => (
            <span key={tag.id} className={styles.tag} title={tag.name}>
              <QueueColorDot hue={tag.colorHue} />
              <span className={styles.ellipsis}>{tag.name}</span>
            </span>
          ))}
          {tags.length > MAX_TAGS ? <span className={styles.muted} title={tags.slice(MAX_TAGS).map((tag) => tag.name).join(", ")}>+{tags.length - MAX_TAGS}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Telefone legível e alinhado: com DDI 55, "(55) 21 99883-6148"; só com DDD, "(21) 99883-6148"; fora desses formatos,
 * como veio.
 */
export function formatLeadPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const local = (ddd: string, number: string) => `${ddd} ${number.slice(0, number.length - 4)}-${number.slice(-4)}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `(55) ${local(digits.slice(2, 4), digits.slice(4))}`;
  if (digits.length === 10 || digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
  return raw;
}

/** Corretor e unidade (numa coluna só, para a tabela caber), com os sinais da tabela atual: plantão ativo,
 * investigação da gestão e devolvido sem aceite. */
function BrokerCell({ lead }: { lead: LeadWorkspaceItem }) {
  return (
    <span className={styles.brokerCell}>
      <span className={lead.corretorNome ? undefined : styles.muted}>{lead.corretorNome ?? "Sem atribuição"}</span>
      <span className={styles.subtle}>{lead.branchName ?? "Sem unidade"}</span>
      {lead.isPlantaoAtivo ? <span className={styles.badge} data-tone="warning">Plantão ativo</span> : null}
      {lead.isManagementInvestigation ? <span className={styles.badge} data-tone="neutral">Investigação da gestão</span> : null}
      {lead.returnedUnaccepted && !lead.corretorNome ? (
        <span className={styles.badge} data-tone="warning" title="Já passou por um corretor que não aceitou ou não atendeu a tempo; aguardando novo corretor">Devolvido, não aceito</span>
      ) : null}
    </span>
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

/** Escolhe a lista da tela: a Lite com a chave do diretor e a rota fora do opt-out; a tabela atual nos demais casos. */
export function LeadsListSwitch({ liteBulk, ...props }: LeadsDataTableProps & { liteBulk?: LeadsLiteBulkConfig }) {
  const lite = useDirectorLitePage();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pagePending, startPage] = useTransition();
  if (!lite) return <LeadsDataTable {...props} />;
  // Mesma navegação da tabela atual: troca só o `?page`, mantém os filtros e renderiza no servidor.
  const goToPage = (page: number) => {
    const next = new URLSearchParams(typeof window === "undefined" ? params.toString() : window.location.search);
    next.set("page", String(page));
    startPage(() => router.replace(`${pathname ?? "/leads"}?${next.toString()}`, { scroll: false }));
  };
  return (
    <LeadsLiteList
      leads={props.leads}
      contextRole={props.contextRole}
      onRowClick={props.onRowClick}
      pagination={props.pagination}
      onPageChange={goToPage}
      pagePending={pagePending}
      selectedIds={Array.isArray(props.selectedIds) ? props.selectedIds : props.selectedIds instanceof Set ? [...props.selectedIds] : undefined}
      onToggleRow={props.onToggleRow}
      onSelectAll={props.onSelectAll}
      isAllSelected={props.isAllSelected}
      bulk={liteBulk}
    />
  );
}

/**
 * Fila da Qualificação IA: a lista Lite com a chave (mesmas colunas da tabela atual que cabem nesse lead: etapa, fila,
 * qualificação, origem, chegada e ações; ainda sem corretor) e a tabela atual nos demais casos. Sem seleção em massa,
 * como hoje. Paginação no cliente, de 20 em 20.
 */
const QUALIFYING_PAGE_SIZE = 20;

export function QualifyingLeadsListSwitch(props: QualifyingLeadsDataTableProps) {
  const lite = useDirectorLitePage();
  const [page, setPage] = useState(1);
  if (!lite) return <QualifyingLeadsDataTable {...props} />;
  // Os leads em qualificação já vêm todos para o cliente: páginas de 20 aqui, para não renderizar centenas de linhas.
  const totalPages = Math.max(1, Math.ceil(props.leads.length / QUALIFYING_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageLeads = props.leads.slice((current - 1) * QUALIFYING_PAGE_SIZE, current * QUALIFYING_PAGE_SIZE);
  const rows: LeadWorkspaceItem[] = pageLeads.map((lead) => ({
    ...lead,
    sourceCampaign: lead.sourceCampaign ?? null,
    assignedAt: null,
    stageEnteredAt: null,
    serviceStartedAt: null,
    firstContactAt: null,
    corretorId: null,
    corretorNome: null,
    branchId: lead.branchId ?? null,
    branchName: lead.branchName ?? null,
  }));
  const open = props.onOpen;
  return (
    <LeadsLiteList
      leads={rows}
      contextRole="director"
      onRowClick={open ? (row) => {
        const original = props.leads.find((lead) => lead.id === row.id);
        if (original) open(original);
      } : undefined}
      pagination={{ currentPage: current, pageSize: QUALIFYING_PAGE_SIZE, totalItems: props.leads.length, totalPages }}
      onPageChange={setPage}
    />
  );
}
