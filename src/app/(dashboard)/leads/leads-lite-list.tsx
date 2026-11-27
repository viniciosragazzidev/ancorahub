"use client";

/**
 * Lista de /leads no visual Lite (chave ligada e rota fora do opt-out): tabela a partir de 768px e cartões abaixo,
 * paginação pela URL (`?page`, como a tabela atual) com o total do filtro. A troca de visão é a barra do workspace,
 * na mesma linha da busca e dos filtros. As informações da tabela atual: etiquetas, entrada pelo WhatsApp, etapa, fila,
 * qualificação, corretor com plantão, investigação e devolução sem aceite (com destaque da linha), unidade e chegada.
 * Ações da linha num menu; seleção em massa com a barra de lote. A busca fica nos filtros Lite.
 */
import { formatLastActivity, LeadNameHoverCard } from "@/features/leads/components/lead-hover-card";
import { journeyFromLeadFields } from "@/features/lead-journey/rows";
import { toast } from "@/components/ui/sonner";
import { getLeadProductLabel } from "@/features/leads/meta-lead-display";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { BrokerProfileLink } from "@/components/broker-profile-link";
import { Leads1a1Menu, type Leads1a1MenuItem as LiteMenuItem } from "./_components/leads-1a1-menu";
import a1 from "./leads-1a1.module.css";
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
import { formatLeadPhone } from "@/features/leads/format-lead-phone";

export { formatLeadPhone };

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

export function qualificationOf(status: string | null | undefined): { label: string; tone: Tone } | null {
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
  // Resultado da busca em uma linha, com a saída ao lado (skill interface-enxuta, ref P3).
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchTerm = searchParams.get("search")?.trim() ?? "";
  const clearSearch = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("search");
    next.delete("page");
    router.push(next.size ? `${pathname}?${next}` : (pathname ?? "/leads"), { scroll: false });
  };
  const selected = useMemo(() => selectedIds ?? [], [selectedIds]);
  const selectable = Boolean(onToggleRow);
  const allSelected = isAllSelected || (leads.length > 0 && leads.every((lead) => selected.includes(lead.id)));
  const total = pagination?.totalItems ?? leads.length;
  const page = pagination?.currentPage ?? 1;
  const size = pagination?.pageSize ?? (leads.length || 20);
  const totalPages = pagination?.totalPages ?? 1;
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  // Desenho 1:1 do artifact "Leads da gestão" (27/11/2026): tabela num cartão, linha em grade, caixa de seleção,
  // etapa, fila com ponto, qualificação, corretor e unidade com os selos, chegada e "⋯"; cartões no celular.
  return (
    <div className={`arc-venancor ${a1.gx} ${styles.root}`} data-skin="diretor">
      {searchTerm ? (
        <p className={a1.result} role="status">
          {total.toLocaleString("pt-BR")} {total === 1 ? "lead" : "leads"} para &ldquo;{searchTerm}&rdquo; ·{" "}
          <button type="button" onClick={clearSearch}>Limpar busca</button>
        </p>
      ) : null}
      <section className={`${a1.card} ${a1.tableCard} ${a1.in} ${a1.tableOnly}`} aria-label="Lista de leads">
        <div className={a1.wide} role="table" aria-label="Leads" data-lite="table">
          <div className={`${a1.trow} ${a1.th}`} role="row" data-broker={isBroker ? "false" : undefined}>
            {selectable ? (
              <span className={a1.checkHit} role="columnheader">
                <button type="button" role="checkbox" aria-checked={allSelected} aria-label="Selecionar todos" className={a1.check} onClick={() => onSelectAll?.(!allSelected)}>
                  {allSelected ? <CheckMark /> : null}
                </button>
              </span>
            ) : <span role="columnheader" />}
            <span role="columnheader">Lead</span><span role="columnheader">Etapa</span><span role="columnheader">Fila</span><span role="columnheader">Qualificação</span><span role="columnheader">Corretor e unidade</span>
            {isBroker ? null : <span role="columnheader">Chegada</span>}
            <span role="columnheader" className={a1.srOnly}>Ações</span>
          </div>
          {leads.map((lead) => {
            const checked = selected.includes(lead.id);
            const qualification = qualificationOf(lead.qualificationStatus);
            return (
              <div
                key={lead.id}
                role="row"
                data-row="lead"
                className={a1.trow}
                data-broker={isBroker ? "false" : undefined}
                data-selected={checked ? "true" : undefined}
                data-tone={checked ? undefined : rowTone(lead)}
                onClick={() => onRowClick?.(lead)}
              >
                {selectable ? (
                  <span className={a1.checkHit} role="cell" onClick={(event) => event.stopPropagation()}>
                    <button type="button" role="checkbox" aria-checked={checked} aria-label={`Selecionar ${lead.nome}`} className={a1.check} onClick={() => onToggleRow?.(lead.id)}>
                      {checked ? <CheckMark /> : null}
                    </button>
                  </span>
                ) : <span role="cell" />}
                <LeadName lead={lead} hideEntry={isBroker} onOpen={onRowClick} />
                <span role="cell"><span className={a1.badge} data-tone={stageTone(lead.status)}>{liteStageLabel(lead.status)}</span></span>
                {lead.queueName ? (
                  <span role="cell" className={a1.queueCell}><QueueColorDot hue={lead.queueColorHue} /><span className={a1.ellipsis}>{lead.queueName}</span></span>
                ) : <span role="cell" className={a1.muted}>Sem fila</span>}
                <span role="cell">{qualification ? <span className={a1.badge} data-tone={qualification.tone}>{qualification.label}</span> : <span className={a1.muted}>Sem qualificação</span>}</span>
                <BrokerCell lead={lead} />
                {isBroker ? null : <span role="cell" className={a1.arrival}><time dateTime={lead.createdAt} title={chegada.format(new Date(lead.createdAt))}>{formatLastActivity(lead.createdAt)}</time></span>}
                <span role="cell" onClick={(event) => event.stopPropagation()}>
                  <Leads1a1Menu variant="row" label={`Ações de ${lead.nome}`} items={rowActions(lead, onRowClick)} />
                </span>
              </div>
            );
          })}
        </div>
        {leads.length === 0 ? <p className={a1.empty}>Nenhum lead neste filtro.</p> : null}
        {pagination && onPageChange ? (
          <div className={a1.pager}>
            <span className={a1.pagerInfo}>{total ? `${from.toLocaleString("pt-BR")} a ${to.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} leads` : "0 leads"}</span>
            <Pages page={page} totalPages={totalPages} onPageChange={onPageChange} pending={pagePending} />
          </div>
        ) : null}
      </section>
      <div className={`${a1.mCards} ${a1.cardsOnly}`}>
        {leads.map((lead) => {
          const qualification = qualificationOf(lead.qualificationStatus);
          const checked = selected.includes(lead.id);
          return (
            <article key={lead.id} className={`${a1.card} ${a1.mCard}`} data-selected={checked ? "true" : undefined} onClick={() => onRowClick?.(lead)}>
              <span className={a1.mTop}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className={a1.mName}>{lead.nome}</span>
                  <span className={a1.mSub}>{formatLeadPhone(lead.telefone)}{isBroker ? null : <> · {formatLastActivity(lead.createdAt)}</>}</span>
                </span>
                <span className={a1.badge} data-tone={stageTone(lead.status)}>{liteStageLabel(lead.status)}</span>
              </span>
              <span className={a1.mLine}>
                {lead.queueName ? <><QueueColorDot hue={lead.queueColorHue} />{lead.queueName}</> : <span className={a1.muted}>Sem fila</span>}
                <span className={a1.muted}>·</span>
                {qualification ? <span className={a1.badge} data-tone={qualification.tone}>{qualification.label}</span> : <span className={a1.muted}>Sem qualificação</span>}
              </span>
              <span className={a1.mFoot}>{lead.corretorNome ? `${lead.corretorNome} · ${lead.branchName ?? "Sem unidade"}` : "-"}</span>
            </article>
          );
        })}
        {leads.length === 0 ? <p className={a1.empty}>Nenhum lead neste filtro.</p> : null}
        {pagination && onPageChange && page < totalPages ? (
          <button type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillFlat}`} disabled={pagePending} onClick={() => onPageChange(page + 1)}>
            {pagePending ? "Carregando…" : "Carregar mais"}
          </button>
        ) : null}
      </div>
      {selectable ? (
        <LeadsLiteBulk selectedIds={selected} onClear={() => onSelectAll?.(false)} config={bulk ?? { role: contextRole, brokers: [], branches: [] }} />
      ) : null}
    </div>
  );
}

function CheckMark() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>;
}

/** Páginas: a atual em branco, as vizinhas, a primeira e a última, anterior e próxima. */
function Pages({ page, totalPages, onPageChange, pending }: { page: number; totalPages: number; onPageChange: (page: number) => void; pending: boolean }) {
  const list = [...new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages))].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  list.forEach((value, index) => {
    if (index && value - list[index - 1] > 1) items.push("gap");
    items.push(value);
  });
  return (
    <nav aria-label="Páginas de leads" className={a1.pages}>
      <button type="button" className={a1.pg} aria-label="Página anterior" disabled={page <= 1 || pending} onClick={() => onPageChange(page - 1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
      </button>
      {items.map((item, index) => item === "gap" ? (
        <span key={`gap-${index}`} className={a1.pg} aria-hidden="true">…</span>
      ) : (
        <button key={item} type="button" className={a1.pg} aria-current={item === page ? "page" : undefined} disabled={pending} onClick={() => onPageChange(item)}>{item}</button>
      ))}
      <button type="button" className={a1.pg} aria-label="Próxima página" disabled={page >= totalPages || pending} onClick={() => onPageChange(page + 1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>
    </nav>
  );
}

/** Até 2 etiquetas e "+N" (com os nomes no title): nunca passa de 2 linhas no cartão nem na tabela. */
const MAX_TAGS = 2;

/**
 * Nome (até 2 linhas, quebra só nos espaços, reticências e nome inteiro no title), e embaixo a entrada pelo WhatsApp e
 * as etiquetas, como na tabela atual.
 */
/** Telefone embaixo do nome: um clique copia (tarefa de todo dia), sem abrir a ficha. Nível 0 do FEEDBACK: só texto. */
function CopyPhone({ phone }: { phone: string }) {
  if (!phone) return null;
  const formatted = formatLeadPhone(phone);
  return (
    <button
      type="button"
      className={a1.phone}
      title="Copiar telefone"
      aria-label={`Copiar telefone ${formatted}`}
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(phone.replace(/\D/g, "")).then(
          () => toast.success("Telefone copiado", { description: formatted, duration: 1600 }),
          () => toast.error("Não deu para copiar o telefone", { description: "Selecione o número e copie manualmente." }),
        );
      }}
    >
      {formatted}
    </button>
  );
}

/** Último movimento conhecido do lead (troca de etapa, primeiro contato ou atribuição), para o hover card. */
function lastActivity(lead: LeadWorkspaceItem): string | null {
  const dates = [lead.stageEnteredAt, lead.firstContactAt, lead.assignedAt].filter((value): value is string => Boolean(value));
  return dates.sort().at(-1) ?? null;
}

function LeadName({ lead, hideEntry, onOpen }: { lead: LeadWorkspaceItem; hideEntry: boolean; onOpen?: (lead: LeadWorkspaceItem) => void }) {
  const entry = hideEntry ? null : readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
  const tags = lead.tags ?? [];
  const whatsapp = entry?.entry === "whatsapp";
  return (
    <span className={a1.leadCell} role="cell">
      <LeadNameHoverCard
        lead={{
          id: lead.id,
          name: lead.nome,
          status: lead.status,
          phone: lead.telefone,
          product: getLeadProductLabel({ tipo: lead.tipo, sourceChannel: lead.sourceChannel, sourceMetadata: lead.sourceMetadata }),
          monthlyValue: lead.monthlyValue ?? null,
          lives: lead.livesCount ?? null,
          lastActivityAt: lastActivity(lead),
          brokerName: lead.corretorNome ?? null,
          context: [lead.queueName, lead.branchName, hideEntry ? null : lead.origem].filter(Boolean).join(" · ") || null,
          journey: journeyFromLeadFields(lead),
        }}
        onOpen={onOpen ? () => onOpen(lead) : undefined}
        href={onOpen ? undefined : `/leads/${lead.id}`}
      >
        <span tabIndex={0} title={lead.nome} className={`${a1.leadName} outline-none`}>{lead.nome}</span>
      </LeadNameHoverCard>
      <span className={a1.leadMeta} onClick={(event) => event.stopPropagation()}>
        <CopyPhone phone={lead.telefone} />
        {whatsapp ? (
          <span className={`${a1.tag} ${a1.tagWa}`} title={entry?.adsLabel ? `Entrou pelo WhatsApp: ${entry.adsLabel}` : "Entrou pelo WhatsApp"}>WhatsApp</span>
        ) : null}
        {tags.slice(0, MAX_TAGS).map((tag) => (
          <span key={tag.id} className={a1.tag} title={tag.name}>
            <QueueColorDot hue={tag.colorHue} />
            <span className={a1.ellipsis}>{tag.name}</span>
          </span>
        ))}
        {tags.length > MAX_TAGS ? <span className={a1.muted} title={tags.slice(MAX_TAGS).map((tag) => tag.name).join(", ")}>+{tags.length - MAX_TAGS}</span> : null}
      </span>
    </span>
  );
}


/** Corretor e unidade (numa coluna só, para a tabela caber), com os sinais da tabela atual: plantão ativo,
 * investigação da gestão e devolvido sem aceite. */
function BrokerCell({ lead }: { lead: LeadWorkspaceItem }) {
  // Sem corretor (27/11/2026): só um traço; o aviso de devolvido continua, porque pede ação.
  if (!lead.corretorNome) {
    return (
      <span className={a1.brokerCell} role="cell">
        <span className={a1.brokerText}>
          <span className={`${a1.ellipsis} ${a1.muted}`}>-</span>
          {lead.returnedUnaccepted ? (
            <span className={a1.brokerFlags}>
              <span className={`${a1.badge} ${a1.badgeSmall}`} data-tone="warning" title="Já passou por um corretor que não aceitou ou não atendeu a tempo; aguardando novo corretor">Devolvido, não aceito</span>
            </span>
          ) : null}
        </span>
      </span>
    );
  }
  return (
    <span className={a1.brokerCell} role="cell">
      {lead.corretorNome ? <span className={a1.av} aria-hidden="true">{initialsOf(lead.corretorNome)}</span> : null}
      <span className={a1.brokerText}>
        <span className={lead.corretorNome ? a1.ellipsis : `${a1.ellipsis} ${a1.muted}`} onClick={(event) => event.stopPropagation()}>
          {lead.corretorNome ? <BrokerProfileLink brokerId={lead.corretorId} name={lead.corretorNome} /> : "Sem atribuição"}
        </span>
        <span className={a1.brokerFlags}>
          <span className={a1.unit}>{lead.branchName ?? "Sem unidade"}</span>
          {lead.isPlantaoAtivo ? <span className={`${a1.badge} ${a1.badgeSmall}`} data-tone="success">Plantão ativo</span> : null}
          {lead.isManagementInvestigation ? <span className={`${a1.badge} ${a1.badgeSmall}`}>Investigação da gestão</span> : null}
          {lead.isTeamList ? <span className={`${a1.badge} ${a1.badgeSmall}`} title="Importado pela supervisão na lista interna da equipe">Lead de equipe</span> : null}
          {lead.returnedUnaccepted && !lead.corretorNome ? (
            <span className={`${a1.badge} ${a1.badgeSmall}`} data-tone="warning" title="Já passou por um corretor que não aceitou ou não atendeu a tempo; aguardando novo corretor">Devolvido, não aceito</span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

/** As mesmas ações de hoje: drawer de gestão, página completa e WhatsApp (quando há telefone). */
function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((part) => part.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

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

export function QualifyingLeadsListSwitch({ contextRole, ...props }: QualifyingLeadsDataTableProps & { contextRole?: string }) {
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
      contextRole={contextRole}
      onRowClick={open ? (row) => {
        const original = props.leads.find((lead) => lead.id === row.id);
        if (original) open(original);
      } : undefined}
      pagination={{ currentPage: current, pageSize: QUALIFYING_PAGE_SIZE, totalItems: props.leads.length, totalPages }}
      onPageChange={setPage}
    />
  );
}
