"use client";

/**
 * Gaveta do lead na /leads da gestão (Lite, diretor e gestor), 1:1 ao artifact "Leads da gestão" (27/11/2026):
 * cabeçalho com avatar, nome, telefone e corretor e os selos; "Abrir conversa" e "Ver cadastro"; o Resumo operacional
 * em linhas chave e valor; "Intervir na operação" com as ações de hoje; "Abrir atendimento completo" no fim.
 * Dados, permissões e Server Actions são os mesmos da gaveta atual (`LeadDetailsDrawer`), que decide quando usar esta.
 */
import { useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { queueHueToDotColor } from "@/features/lead-distribution/queue-color";
import { distributionRemovalTag } from "@/features/lead-distribution/distribution-removal";
import { computeLeadHealth, type LeadHealth } from "@/features/leads/components/lead-health-badge";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { formatDate } from "@/features/quotes/utils";

import { qualificationOf } from "../leads-lite-list";
import a1 from "../leads-1a1.module.css";
import { liteStageLabel } from "../lite-stage-labels";

type Props = {
  lead: LeadWorkspaceItem;
  contextRole: string;
  /** Nome e telefone como a gaveta atual mostra (com a máscara do marketing quando vale). */
  displayName: string;
  displayPhone: string;
  masked: boolean;
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
  onClose: () => void;
  /** Motivo da investigação já resolvido pela gaveta atual (carregando, erro ou o texto). */
  investigationReason: string | null;
  /** "Marcar em atendimento" do diretor, quando vale. */
  markInService?: ReactNode;
  topSlot?: ReactNode;
  /** Intervir na operação: as ações de gestão de hoje, já na marcação do artifact. */
  management: ReactNode;
  /** Cotações (valores comerciais ligados) e histórico de atribuição, que seguem os componentes de hoje. */
  quotes?: ReactNode;
  history?: ReactNode;
};

const HEALTH_TONE: Record<LeadHealth["type"], string | undefined> = {
  "critical-unworked": "danger",
  "warning-at-risk": "warning",
  "warning-stalled": "warning",
  "muted-no-broker": undefined,
  "muted-unassigned": undefined,
  "success-healthy": "success",
  "info-new": "info",
};

const STAGE_TONE: Record<string, string | undefined> = {
  in_contact: "info",
  contacted: "info",
  negotiation: "info",
  converted: "success",
  lost: "danger",
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

const when = (value: string | null | undefined) => formatDate(value ?? null, { dateStyle: "short", timeStyle: "short" });

export function LeadDrawer1a1({
  lead, contextRole, displayName, displayPhone, masked, slaFirstContactMinutes, slaStagnantDays, onClose,
  investigationReason, markInService, topSlot, management, quotes, history,
}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Esc fecha a gaveta só quando nenhum diálogo de confirmação está aberto por cima.
      if (event.key === "Escape" && !document.querySelector("[role='alertdialog'], [data-slot='dialog-popup']")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const focusOnMount = useCallback((node: HTMLElement | null) => { node?.focus(); }, []);

  if (typeof document === "undefined") return null;

  const qualification = qualificationOf(lead.qualificationStatus);
  const health = computeLeadHealth(lead, slaFirstContactMinutes, slaStagnantDays);
  const removalTag = !lead.corretorId ? distributionRemovalTag(lead.distributionRemovalReason) : null;
  const owner = lead.corretorNome ?? "Aguardando distribuição";

  return createPortal(
    <div className={`arc-venancor ${a1.gx}`} data-skin="diretor">
      <div className={a1.scrim} aria-hidden="true" onClick={onClose} />
      <aside ref={focusOnMount} tabIndex={-1} className={a1.drawer} role="dialog" aria-modal="true" aria-label={`Lead ${displayName}`}>
        <div className={a1.drawerHead}>
          <span className={`${a1.av} ${a1.avLg}`} aria-hidden="true">{masked ? "·" : initialsOf(lead.nome)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className={a1.drawerName} style={masked ? { filter: "blur(3px)", userSelect: "none" } : undefined}>{displayName}</p>
            <p className={`${a1.drawerText} ${a1.num}`}>
              <span style={masked ? { filter: "blur(3px)", userSelect: "none" } : undefined}>{displayPhone}</span>
              {" · "}
              {lead.corretorNome ? <BrokerProfileLink brokerId={lead.corretorId} name={lead.corretorNome} viewerRole={contextRole} /> : owner}
            </p>
            <div className={a1.drawerBadges}>
              <span className={a1.badge} data-tone={STAGE_TONE[lead.status]}>{liteStageLabel(lead.status)}</span>
              {qualification ? <span className={a1.badge} data-tone={qualification.tone}>{qualification.label}</span> : null}
              <span className={a1.badge} data-tone={HEALTH_TONE[health.type]}>{health.label}</span>
              {lead.queueName ? (
                <span className={a1.badge} title={`Fila: ${lead.queueName}`}>
                  <span className={a1.dot} style={{ background: queueHueToDotColor(lead.queueColorHue), marginRight: 6 }} aria-hidden="true" />
                  {lead.queueName}
                </span>
              ) : null}
              {removalTag ? <span className={a1.badge} title={lead.distributionRemovalNote ? `Observação: ${lead.distributionRemovalNote}` : undefined}>{removalTag}</span> : null}
            </div>
            {markInService ? <div style={{ marginTop: 8 }}>{markInService}</div> : null}
          </div>
          <button type="button" className={a1.iconbtn} aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {topSlot}

        {!lead.corretorId && lead.distributionStatus === "returned_to_queue" ? (
          <section className={`${a1.card} ${a1.warnCard}`}>
            <p><strong>Lead aguardando reatribuição</strong></p>
            <p>O corretor responsável foi excluído. O lead voltou para a fila e precisa ser reatribuído manualmente.</p>
          </section>
        ) : null}

        <div className={a1.grid2Actions}>
          <Link className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat}`} href={`/conversas?leadId=${lead.id}`}>Abrir conversa</Link>
          <Link className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat}`} href={`/leads/${lead.id}`}>Ver cadastro</Link>
        </div>

        <section className={`${a1.card} ${a1.kvCard}`} aria-label="Resumo operacional">
          <p className={a1.sectionTitle}>Resumo operacional</p>
          <div className={a1.kv}><span>Responsável</span><span>{lead.corretorNome ? <BrokerProfileLink brokerId={lead.corretorId} name={lead.corretorNome} viewerRole={contextRole} /> : owner}</span></div>
          {lead.isManagementInvestigation ? (
            <div className={a1.kv}><span>Motivo da investigação</span><span style={{ whiteSpace: "pre-wrap" }}>{investigationReason ?? "Carregando motivo registrado…"}</span></div>
          ) : null}
          <div className={a1.kv}><span>Unidade</span><span>{lead.branchName ?? "Sem unidade"}</span></div>
          <div className={a1.kv}><span>Recebeu o lead</span><span className={a1.num}>{when(lead.assignedAt)}</span></div>
          <div className={a1.kv}><span>Primeiro contato</span><span className={a1.num}>{when(lead.firstContactAt)}</span></div>
          <div className={a1.kv}><span>Atendimento iniciado</span><span className={a1.num}>{when(lead.serviceStartedAt)}</span></div>
          <div className={a1.kv}><span>Etapa atual desde</span><span className={a1.num}>{when(lead.stageEnteredAt)}</span></div>
          {lead.lastContactAt !== undefined ? (
            <div className={a1.kv}><span>Último contato</span><span className={a1.num}>{lead.lastContactAt ? when(lead.lastContactAt) : "Sem contato ainda"}</span></div>
          ) : null}
        </section>

        <section className={`${a1.card} ${a1.section}`} aria-label="Intervir na operação">
          <p className={a1.sectionTitle}>Intervir na operação</p>
          {management}
        </section>

        {quotes ? <section className={`${a1.card} ${a1.section}`}>{quotes}</section> : null}
        {history}

        <Link className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat}`} href={`/leads/${lead.id}`}>Abrir atendimento completo</Link>
      </aside>
    </div>,
    document.body,
  );
}
