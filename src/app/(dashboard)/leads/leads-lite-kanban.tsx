"use client";

/**
 * Kanban de /leads no visual Lite (chave do diretor). Mesmo comportamento do kanban atual: as colunas são as etapas
 * visíveis na ordem guardada, arrastar reordena as colunas (o mesmo `arrayMove` do workspace) e o cartão abre o
 * drawer, seleciona para o lote e abre o WhatsApp. Cartões não mudam de etapa por arrastar, como hoje.
 */
import { useMemo } from "react";
import { MessageCircle } from "lucide-react";

import { LiteKanban } from "@/components/lite/data/kanban";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { computeLeadHealth, type LeadHealth } from "@/features/leads/components/lead-health-badge";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { formatDate } from "@/features/quotes/utils";

import { computeSlaInfo, type SlaInfo } from "./lead-sla";
import { LeadsLiteBulk, type LeadsLiteBulkConfig } from "./leads-lite-bulk";
import styles from "./leads-lite-kanban.module.css";
import { liteStageLabel } from "./lite-stage-labels";

export type LeadsLiteKanbanProps = {
  statuses: string[];
  groupedLeads: Record<string, LeadWorkspaceItem[]>;
  onMoveColumn: (activeId: string, overId: string) => void;
  onOpen: (lead: LeadWorkspaceItem) => void;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  selectedIds: string[];
  onClearSelection: () => void;
  bulk: LeadsLiteBulkConfig;
  /** Corretor não vê a data de chegada no cartão (mesma regra de hoje). */
  hideArrival?: boolean;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
};

export function LeadsLiteKanban({
  statuses, groupedLeads, onMoveColumn, onOpen, isSelected, onToggle, selectedIds, onClearSelection, bulk,
  hideArrival = false, slaFirstContactMinutes = 15, slaStagnantDays = 3,
}: LeadsLiteKanbanProps) {
  const columns = useMemo(
    () => statuses.map((status) => ({ id: status, title: liteStageLabel(status), items: groupedLeads[status] ?? [] })),
    [statuses, groupedLeads],
  );
  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <LiteKanban
        label="Funil de leads em Kanban"
        columns={columns}
        itemKey={(lead) => lead.id}
        onMoveColumn={onMoveColumn}
        renderCard={(lead) => (
          <LeadKanbanCard
            lead={lead}
            selected={isSelected(lead.id)}
            onToggle={onToggle}
            onOpen={onOpen}
            hideArrival={hideArrival}
            slaFirstContactMinutes={slaFirstContactMinutes}
            slaStagnantDays={slaStagnantDays}
          />
        )}
      />
      <p className={styles.hint}>Arraste as colunas para reordenar, ou use a alça com espaço e setas. Use o botão &quot;Colunas&quot; para exibir ou ocultar etapas.</p>
      <LeadsLiteBulk selectedIds={selectedIds} onClear={onClearSelection} config={bulk} />
    </div>
  );
}

function slaTone(ratio: number) {
  if (ratio >= 1) return "danger";
  if (ratio >= 0.4) return "warning";
  return "success";
}

function healthTone(health: LeadHealth) {
  if (health.type.startsWith("critical")) return "danger";
  if (health.type.startsWith("warning")) return "warning";
  if (health.type.startsWith("success")) return "success";
  if (health.type.startsWith("info")) return "info";
  return "neutral";
}

function LeadKanbanCard({ lead, selected, onToggle, onOpen, hideArrival, slaFirstContactMinutes, slaStagnantDays }: {
  lead: LeadWorkspaceItem;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (lead: LeadWorkspaceItem) => void;
  hideArrival: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
}) {
  const sla = computeSlaInfo(lead, slaFirstContactMinutes, slaStagnantDays, liteStageLabel);
  const health = computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays);
  const phoneDigits = lead.telefone ? lead.telefone.replace(/\D/g, "") : "";
  return (
    // Como hoje, puxar o cartão por mais de 8px arrasta a coluna inteira; clique abre o drawer.
    <article className={styles.card} data-selected={selected ? "true" : undefined} data-investigation={lead.isManagementInvestigation ? "true" : undefined}>
      <div className={styles.cardHead}>
        <button type="button" className={styles.nameButton} onClick={() => onOpen(lead)}>
          <span className={styles.name}>{lead.nome}</span>
          {lead.queueName ? (
            <span title={`Fila: ${lead.queueName}`} className={styles.queue}>
              <QueueColorDot hue={lead.queueColorHue} />
              <span className={styles.srOnly}>Fila {lead.queueName}</span>
            </span>
          ) : null}
        </button>
        <span className={styles.cardActions}>
          {phoneDigits ? (
            <a href={`https://wa.me/55${phoneDigits}`} target="_blank" rel="noreferrer" className={styles.iconTarget} aria-label={`Abrir WhatsApp de ${lead.nome}`} title="Abrir WhatsApp">
              <MessageCircle aria-hidden="true" size={16} />
            </a>
          ) : null}
          <label className={styles.iconTarget}>
            <input type="checkbox" className={styles.checkbox} checked={selected} aria-label={`Selecionar ${lead.nome}`} onChange={() => onToggle(lead.id)} />
          </label>
        </span>
      </div>
      <button type="button" className={styles.body} onClick={() => onOpen(lead)} aria-label={`Abrir ${lead.nome}`}>
        <span className={styles.phone}>{lead.telefone}</span>
        <span className={styles.owner}>
          {lead.corretorNome || lead.branchName
            ? <><strong>{lead.corretorNome ?? "Sem corretor"}</strong> · {lead.branchName ?? "Sem unidade"}</>
            : "Aguardando distribuição"}
        </span>
        {sla ? <SlaRow sla={sla} /> : null}
        <span className={styles.meta}>
          <span className={styles.badge} data-tone={lead.status === "converted" ? "success" : lead.status === "lost" ? "danger" : "neutral"}>{liteStageLabel(lead.status)}</span>
          {lead.isManagementInvestigation ? <span className={styles.badge} data-tone="neutral">Investigação da gestão</span> : null}
          <span className={styles.badge} data-tone="neutral">{lead.tipo}</span>
          <span className={styles.badge} data-tone={healthTone(health)}>{health.label}</span>
          {hideArrival ? null : <span className={styles.arrival}>{formatDate(lead.createdAt, { day: "2-digit", month: "short" })}</span>}
        </span>
      </button>
    </article>
  );
}

function SlaRow({ sla }: { sla: NonNullable<SlaInfo> }) {
  const pct = Math.min(100, Math.max(0, sla.ratio * 100));
  const tone = slaTone(sla.ratio);
  return (
    <span className={styles.sla} title={`${sla.title}. ${sla.deadline}`}>
      <span className={styles.slaTrack} aria-hidden="true">
        <span className={styles.slaFill} data-tone={tone} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.slaLabel} data-tone={tone}>{sla.label}</span>
      <span className={styles.srOnly}>{sla.title}. {sla.deadline}</span>
    </span>
  );
}
