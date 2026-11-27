"use client";

/**
 * Kanban de /leads no visual Lite. As colunas são as etapas visíveis na ordem guardada, arrastar reordena as colunas
 * (o mesmo `arrayMove` do workspace) e o cartão abre o drawer, seleciona para o lote e abre o WhatsApp. Cartões não
 * mudam de etapa por arrastar.
 * Área de funil (25/11/2026, do quadro "Funis" do DeskComm): cabeçalho com quantidade, soma do valor e vidas; cartão
 * enxuto (interesse, corretor, último contato, faixa "Sem resposta há X"); ⋯ com Abrir, Próxima etapa e Marcar perdido.
 */
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { LiteKanban, type LiteKanbanSkin } from "@/components/lite/data/kanban";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { queueHueToDotColor } from "@/features/lead-distribution/queue-color";
import { lastContactLabel, noReplyStripe } from "@/features/leads/cooling-radar";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";

import { kanbanColumnSummary } from "./kanban-column-summary";
import { canMarkLost, nextStageFor, type StageActor } from "./lead-card-stage";
import { LeadStageDialog, submitStageChange, type StageDialogState } from "./lead-card-stage-dialog";
import { computeSlaInfo, type SlaInfo } from "./lead-sla";
import { LeadsLiteBulk, type LeadsLiteBulkConfig } from "./leads-lite-bulk";
import { Leads1a1Menu, type Leads1a1MenuItem } from "./_components/leads-1a1-menu";
import a1 from "./leads-1a1.module.css";
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
  /** Menu "Colunas" do artifact: fica no cartão da previsão; sem previsão, quem usa o mostra na linha das visões. */
  columnsMenu?: ReactNode;
};

// Marcação do artifact "Leads da gestão" (27/11/2026) no kanban compartilhado: mesmas colunas, arrastar e teclado.
const KANBAN_SKIN: LiteKanbanSkin = {
  board: a1.kboard,
  column: a1.kcol,
  head: a1.khead,
  handle: a1.khandle,
  title: a1.ktitle,
  count: a1.kcount,
  summary: a1.ksum,
  cards: a1.kcards,
  empty: a1.kempty,
};

const noActor = () => "none" as const;

export function LeadsLiteKanban({
  statuses, groupedLeads, onMoveColumn, onOpen, onQuote, commercialValuesEnabled = false, isSelected, onToggle, selectedIds, onClearSelection, bulk,
  slaFirstContactMinutes = 15, slaStagnantDays = 3, stageActor = noActor, onStageCommitted, forecast = null, columnsMenu,
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
    <div className={`arc-venancor ${a1.gx} ${a1.kanban}`} data-skin="diretor">
      <div aria-live="polite">
        <ActionNoticeLine notice={notice.notice} />
      </div>
      {forecast ? <LeadsLiteForecast forecast={forecast} columnsMenu={columnsMenu} /> : null}
      <LiteKanban
        label="Funil de leads em Kanban"
        columns={columns}
        itemKey={(lead) => lead.id}
        onMoveColumn={onMoveColumn}
        skin={KANBAN_SKIN}
        renderSummary={(column) => kanbanColumnSummary(column.items, { showValue: commercialValuesEnabled })}
        renderCard={(lead) => {
          const actor = stageActor(lead);
          const next = nextStageFor(lead.status, actor);
          const items: Leads1a1MenuItem[] = [{ id: "open", label: "Abrir", onSelect: () => onOpen(lead) }];
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
      <p className={a1.khint}>Arraste as colunas para reordenar, ou use a alça com espaço e setas. Use o botão &quot;Colunas&quot; para exibir ou ocultar etapas.</p>
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
  menuItems: Leads1a1MenuItem[];
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
  // Cartão do artifact: ponto da fila, nome, interesse, dono e último contato, barra do prazo. WhatsApp e seleção para
  // o lote, que hoje ficam no cartão, entram no ⋯ junto de Abrir, Próxima etapa e Marcar perdido.
  const items: Leads1a1MenuItem[] = [
    ...menuItems,
    ...(phoneDigits ? [{ id: "whatsapp", label: "Abrir WhatsApp", href: `https://wa.me/55${phoneDigits}` }] : []),
    { id: "select", label: selected ? "Tirar da seleção" : "Selecionar para o lote", onSelect: () => onToggle(lead.id) },
  ];
  return (
    // Como hoje, puxar o cartão por mais de 8px arrasta a coluna inteira; clique abre o drawer.
    <article className={a1.kcard} data-selected={selected ? "true" : undefined}>
      {/* Botão esticado cobre o cartão; o link do corretor e o ⋯ ficam por cima dele. */}
      <button type="button" className={a1.kopen} onClick={() => onOpen(lead)} aria-label={`Abrir ${lead.nome}`} aria-describedby={`${detailsId}-interest ${detailsId}-owner ${detailsId}-meta`} />
      <span className={a1.kline}>
        {lead.queueName ? (
          <span className={a1.dot} title={`Fila: ${lead.queueName}`} style={{ background: queueHueToDotColor(lead.queueColorHue) }}>
            <span className={a1.srOnly}>Fila {lead.queueName}</span>
          </span>
        ) : null}
        <span className={a1.kname}>{lead.nome}</span>
        {selected ? <span className={a1.srOnly}>Selecionado</span> : null}
        <Leads1a1Menu label={`Ações de ${lead.nome}`} items={items} variant="row" />
      </span>
      {interest ? <span className={a1.kinterest} id={`${detailsId}-interest`}>{interest}</span> : null}
      <span className={a1.kmeta} id={`${detailsId}-owner`}>
        <span>{lead.corretorNome ? <BrokerProfileLink brokerId={lead.corretorId} name={lead.corretorNome} /> : owner}</span>
        <span title="Último contato">{lastContactLabel(lead.lastContactAt)}</span>
      </span>
      {sla ? <SlaRow sla={sla} /> : null}
      {stripe ? <span className={a1.kstripe}>{stripe}</span> : null}
      {lead.isManagementInvestigation || lead.isTeamList ? (
        <span className={a1.kflags} id={`${detailsId}-meta`}>
          {lead.isManagementInvestigation ? <span className={`${a1.badge} ${a1.badgeSmall}`}>Investigação da gestão</span> : null}
          {lead.isTeamList ? <span className={`${a1.badge} ${a1.badgeSmall}`}>Lead de equipe</span> : null}
        </span>
      ) : null}
    </article>
  );
}

function SlaRow({ sla }: { sla: NonNullable<SlaInfo> }) {
  const pct = Math.min(100, Math.max(0, sla.ratio * 100));
  const tone = slaTone(sla.ratio);
  return (
    <>
      <span className={a1.ksla} title={`${sla.title}. ${sla.deadline}`} aria-hidden="true">
        <span className={a1.kslaFill} data-tone={tone === "success" ? undefined : tone} style={{ width: `${pct}%` }} />
      </span>
      <span className={a1.kstripe}>{sla.label}<span className={a1.srOnly}>. {sla.title}. {sla.deadline}</span></span>
    </>
  );
}
