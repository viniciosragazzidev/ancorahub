"use client";

/**
 * Kanban de /leads no visual Lite. As colunas são as etapas visíveis na ordem guardada, arrastar reordena as colunas
 * (o mesmo `arrayMove` do workspace) e o cartão abre o drawer, seleciona para o lote e abre o WhatsApp. Cartões não
 * mudam de etapa por arrastar.
 * Área de funil (25/11/2026, do quadro "Funis" do DeskComm): cabeçalho com quantidade, soma do valor e vidas; cartão
 * enxuto (interesse, corretor, último contato, faixa "Sem resposta há X"); ⋯ com Abrir, Próxima etapa e Marcar perdido.
 */
import { useCallback, useId, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { LiteMenu, type LiteMenuItem } from "@/components/lite/controls";
import { LiteKanban } from "@/components/lite/data/kanban";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { lastContactLabel, noReplyStripe } from "@/features/leads/cooling-radar";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";

import { kanbanColumnSummary } from "./kanban-column-summary";
import { canMarkLost, nextStageFor, type StageActor } from "./lead-card-stage";
import { LeadStageDialog, submitStageChange, type StageDialogState } from "./lead-card-stage-dialog";
import { computeSlaInfo, type SlaInfo } from "./lead-sla";
import { LeadsLiteBulk, type LeadsLiteBulkConfig } from "./leads-lite-bulk";
import styles from "./leads-lite-kanban.module.css";
import { liteStageLabel } from "./lite-stage-labels";
import { LeadsLiteForecast, type LeadsLiteForecastData } from "./leads-lite-forecast";

export type LeadsLiteKanbanProps = {
  statuses: string[];
  groupedLeads: Record<string, LeadWorkspaceItem[]>;
  onMoveColumn: (activeId: string, overId: string) => void;
  onOpen: (lead: LeadWorkspaceItem) => void;
  onQuote?: (lead: LeadWorkspaceItem) => void;
  commercialValuesEnabled?: boolean;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
  selectedIds: string[];
  onClearSelection: () => void;
  bulk: LeadsLiteBulkConfig;
  /** Corretor não vê a data de chegada no cartão (mesma regra de hoje). */
  hideArrival?: boolean;
  slaFirstContactMinutes?: number;
  slaStagnantDays?: number;
  /** Quem pode mover este lead pelo ⋯ (regra em lead-card-stage.ts). Sem isso, o ⋯ só abre. */
  stageActor?: (lead: LeadWorkspaceItem) => StageActor;
  /** Etapa confirmada pelo servidor: o workspace atualiza o cartão na hora. */
  onStageCommitted?: (input: { leadIds: string[]; newStatus: string }) => void;
  /** Previsão do mês no topo do funil, já no escopo de quem vê. Sem ela, a linha não aparece. */
  forecast?: LeadsLiteForecastData | null;
};

const noActor = () => "none" as const;

export function LeadsLiteKanban({
  statuses, groupedLeads, onMoveColumn, onOpen, onQuote, commercialValuesEnabled = false, isSelected, onToggle, selectedIds, onClearSelection, bulk,
  slaFirstContactMinutes = 15, slaStagnantDays = 3, stageActor = noActor, onStageCommitted, forecast = null,
}: LeadsLiteKanbanProps) {
  const columns = useMemo(
    () => statuses.map((status) => ({ id: status, title: liteStageLabel(status), items: groupedLeads[status] ?? [] })),
    [statuses, groupedLeads],
  );
  const notice = useActionNotice();
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<StageDialogState>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  const committed = useCallback((input: { leadIds: string[]; newStatus: string }) => {
    onStageCommitted?.(input);
  }, [onStageCommitted]);

  // Próxima etapa direta (nível 1): toque, servidor, depois o texto nomeando o resultado. Erro com "Tentar de novo".
  const runNextStage = useCallback(async (lead: LeadWorkspaceItem, status: string) => {
    const actor = stageActor(lead);
    const keeps = `O lead continua em ${liteStageLabel(lead.status)}.`;
    const retry = () => { void runNextStage(lead, status); };
    notice.tap();
    setBusyLeadId(lead.id);
    try {
      const outcome = await submitStageChange(actor, { leadId: lead.id, newStatus: status });
      if (outcome && outcome.ok === false) {
        notice.fail(outcome.reason, { keeps, retry });
        return;
      }
      notice.succeed(`${lead.nome} foi para ${liteStageLabel(status)}.`);
      committed({ leadIds: [lead.id], newStatus: status });
    } catch (error) {
      notice.fail(error, { keeps, retry });
    } finally {
      setBusyLeadId(null);
    }
  }, [committed, notice, stageActor]);

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <div aria-live="polite" className={styles.notice}>
        <ActionNoticeLine notice={notice.notice} />
      </div>
      {forecast ? <LeadsLiteForecast forecast={forecast} /> : null}
      <LiteKanban
        label="Funil de leads em Kanban"
        columns={columns}
        itemKey={(lead) => lead.id}
        onMoveColumn={onMoveColumn}
        renderSummary={(column) => kanbanColumnSummary(column.items, { showValue: commercialValuesEnabled })}
        renderCard={(lead) => {
          const actor = stageActor(lead);
          const next = nextStageFor(lead.status, actor);
          const items: LiteMenuItem[] = [{ id: "open", label: "Abrir", onSelect: () => onOpen(lead) }];
          if (commercialValuesEnabled && onQuote) items.push({ id: "quote", label: "Fazer cotação", onSelect: () => onQuote(lead) });
          if (next) {
            const label = `Próxima etapa: ${liteStageLabel(next.status)}`;
            if (next.mode === "page") items.push({ id: "next", label, href: `/leads/${lead.id}` });
            else items.push({
              id: "next",
              label: busyLeadId === lead.id ? "Movendo…" : label,
              disabled: busyLeadId === lead.id,
              onSelect: () => next.mode === "note" ? setDialog({ lead, mode: "note", status: next.status }) : void runNextStage(lead, next.status),
            });
          }
          if (canMarkLost(lead.status, actor)) items.push({ id: "lost", label: "Marcar perdido…", tone: "danger", onSelect: () => setDialog({ lead, mode: "lost", status: "lost" }) });
          return (
            <LeadKanbanCard
              lead={lead}
              selected={isSelected(lead.id)}
              onToggle={onToggle}
              onOpen={onOpen}
              menuItems={items}
              slaFirstContactMinutes={slaFirstContactMinutes}
              slaStagnantDays={slaStagnantDays}
            />
          );
        }}
      />
      <p className={styles.hint}>Arraste as colunas para reordenar, ou use a alça com espaço e setas. Use o botão &quot;Colunas&quot; para exibir ou ocultar etapas.</p>
      <LeadsLiteBulk selectedIds={selectedIds} onClear={onClearSelection} config={bulk} />
      <LeadStageDialog state={dialog} actor={dialog ? stageActor(dialog.lead) : "none"} onClose={closeDialog} onCommitted={committed} />
    </div>
  );
}

function slaTone(ratio: number) {
  if (ratio >= 1) return "danger";
  if (ratio >= 0.4) return "warning";
  return "success";
}

/** Interesse do lead: tipo, operadora ou plano e vidas, só o que houver ("PME · Amil · 3 vidas"). */
export function leadInterestLabel(lead: Pick<LeadWorkspaceItem, "tipo" | "sourceChannel" | "sourceMetadata" | "livesCount">): string | null {
  const meta = readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
  const plan = meta.operadora ?? meta.tipoPlano;
  const lives = Number.isInteger(lead.livesCount) && Number(lead.livesCount) > 0 ? Number(lead.livesCount) : null;
  const parts = [lead.tipo || null, plan, lives ? (lives === 1 ? "1 vida" : `${lives} vidas`) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Quem atende: o corretor, a IA (qualificando) ou ninguém. */
export function leadOwnerLabel(lead: Pick<LeadWorkspaceItem, "corretorNome" | "qualificationState" | "qualificationStatus">): string {
  if (lead.corretorNome) return lead.corretorNome;
  const aiWorking = lead.qualificationState === "IN_PROGRESS" || lead.qualificationStatus === "pending" || lead.qualificationStatus === "qualifying";
  return aiWorking ? "IA atendendo" : "Sem corretor";
}

function LeadKanbanCard({ lead, selected, onToggle, onOpen, menuItems, slaFirstContactMinutes, slaStagnantDays }: {
  lead: LeadWorkspaceItem;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (lead: LeadWorkspaceItem) => void;
  menuItems: LiteMenuItem[];
  slaFirstContactMinutes: number;
  slaStagnantDays: number;
}) {
  // Prazo de 1º contato continua com a barra; nas etapas ativas o aviso vira a faixa "Sem resposta há X".
  const firstContactPending = (lead.status === "new" || lead.status === "distributed") && !lead.firstContactAt;
  const sla = firstContactPending ? computeSlaInfo(lead, slaFirstContactMinutes, slaStagnantDays, liteStageLabel) : null;
  const stripe = firstContactPending ? null : noReplyStripe(lead, slaStagnantDays);
  const interest = leadInterestLabel(lead);
  const owner = leadOwnerLabel(lead);
  const phoneDigits = lead.telefone ? lead.telefone.replace(/\D/g, "") : "";
  const detailsId = useId();
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
          <LiteMenu label={`Ações de ${lead.nome}`} items={menuItems} />
        </span>
      </div>
      {/* Corpo em "botão esticado": o <button> cobre o corpo e o link do corretor fica irmão dele, por cima (ownerLink).
          Nunca dentro de role="button": o leitor de tela trata os filhos de botão como texto e perde o link. */}
      <div className={styles.body}>
        <button type="button" className={styles.bodyOpen} onClick={() => onOpen(lead)} aria-label={`Abrir ${lead.nome}`} aria-describedby={`${detailsId}-interest ${detailsId}-owner ${detailsId}-meta`} />
        {interest ? <span className={styles.interest} id={`${detailsId}-interest`}>{interest}</span> : null}
        <span className={styles.ownerRow} id={`${detailsId}-owner`}>
          <span className={styles.avatar} aria-hidden="true">{lead.corretorNome ? lead.corretorNome.trim().charAt(0).toUpperCase() : "·"}</span>
          <span className={styles.owner}>
            {lead.corretorNome ? <BrokerProfileLink brokerId={lead.corretorId} name={lead.corretorNome} className={styles.ownerLink} /> : owner}
          </span>
          <span className={styles.lastContact} title="Último contato">{lastContactLabel(lead.lastContactAt)}</span>
        </span>
        {sla ? <SlaRow sla={sla} /> : null}
        {stripe ? <span className={styles.stripe} data-tone="warning">{stripe}</span> : null}
        {lead.isManagementInvestigation || lead.isTeamList ? (
          <span className={styles.meta} id={`${detailsId}-meta`}>
            {lead.isManagementInvestigation ? <span className={styles.badge} data-tone="neutral">Investigação da gestão</span> : null}
            {lead.isTeamList ? <span className={styles.badge} data-tone="neutral">Lead de equipe</span> : null}
          </span>
        ) : null}
      </div>
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
