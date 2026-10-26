"use client";

import { FileCheck2, MessageCircle, TrendingUp, UsersRound } from "lucide-react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { stageLabel } from "@/features/conversation-intelligence/components/radar-model";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { NegotiationLevel } from "./negotiation-model";
import type { NegotiationBrokerStats, NegotiationDayStats, NegotiationLead, NegotiationsDashboardData } from "./queries";
import styles from "./negotiations.module.css";

const LEVEL_LABELS: Record<NegotiationLevel, string> = {
  closing: "Fechamento",
  advanced: "Negociação avançada",
  in_conversation: "Em conversa",
  cooling: "Esfriando",
  no_crm_conversation: "Sem conversa no CRM",
};

const KPI_ITEMS: Array<{ id: NegotiationLevel | "customers_waiting"; label: string; icon: typeof TrendingUp }> = [
  { id: "closing", label: "Fechamento", icon: TrendingUp },
  { id: "advanced", label: "Avançada", icon: MessageCircle },
  { id: "in_conversation", label: "Em conversa", icon: UsersRound },
  { id: "cooling", label: "Esfriando", icon: FileCheck2 },
  { id: "no_crm_conversation", label: "Sem conversa no CRM", icon: FileCheck2 },
  { id: "customers_waiting", label: "Aguardando resposta", icon: UsersRound },
];

function statusLabel(status: string) {
  return LEAD_STATUS_LABELS[status] ?? status;
}

function formatWhen(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Sem troca nos últimos 7 dias";
}

function formatAge(days: number | null) {
  if (days === null) return "Sem data";
  if (days === 0) return "Hoje";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "Sem dados";
  if (seconds < 60) return "Menos de 1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatNegotiationMetric(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function LeadCell({ lead }: { lead: NegotiationLead }) {
  return (
    <span className={styles.cellLead}>
      <span className={styles.cellLeadName} title={lead.name}>{lead.name}</span>
      <span className={styles.cellLeadStatus}>{statusLabel(lead.status)}</span>
    </span>
  );
}

function LevelBadge({ level, customerWaiting }: { level: NegotiationLevel; customerWaiting: boolean }) {
  return (
    <span className={styles.levelGroup}>
      <span className={styles.level} data-level={level}>{LEVEL_LABELS[level]}</span>
      {customerWaiting ? <span className={styles.waitingBadge}>Aguardando resposta</span> : null}
    </span>
  );
}

export function createNegotiationLeadColumns(): LiteColumn<NegotiationLead>[] {
  return [
    { id: "lead", label: "Lead", primary: true, render: (lead) => <LeadCell lead={lead} /> },
    { id: "broker", label: "Corretor", secondary: true, nowrap: true, render: (lead) => <span title={lead.brokerName}>{lead.brokerName}</span> },
    { id: "branch", label: "Unidade", nowrap: true, render: (lead) => lead.branchName ?? "Sem unidade" },
    { id: "level", label: "Nível", render: (lead) => <LevelBadge level={lead.level} customerWaiting={lead.customerWaiting} /> },
    { id: "stage", label: "Etapa", render: (lead) => <span className={styles.stageCell}><span>{statusLabel(lead.status)}</span><span className={styles.muted}>{stageLabel[lead.ai.conversationStage] ?? "Em andamento"}{lead.statusBehindAi ? " · IA à frente" : ""}</span></span> },
    { id: "age", label: "Dias na etapa", numeric: true, render: (lead) => formatAge(lead.daysAtStage) },
    { id: "last", label: "Última troca", nowrap: true, render: (lead) => <span className={styles.tableText} title={formatWhen(lead.lastExchangeAt)}>{formatWhen(lead.lastExchangeAt)}</span> },
    { id: "reply", label: "Resposta de", render: (lead) => lead.replyOwedBy === "broker" ? "Corretor" : lead.replyOwedBy === "customer" ? "Cliente" : "Ninguém" },
    { id: "files", label: "Anexos", render: (lead) => lead.customerSentPdf && lead.customerSentImage ? "PDF e imagem" : lead.customerSentPdf ? "PDF" : lead.customerSentImage ? "Imagem" : "Sem anexos" },
    { id: "ai", label: "Leitura da IA", render: (lead) => <span className={styles.aiText}><strong title={lead.ai.summary ?? "Sem resumo da IA"}>{lead.ai.summary ?? "Sem resumo da IA"}</strong><span className={styles.muted} title={lead.ai.nextBestAction ?? "Sem próxima ação sugerida"}>{lead.ai.nextBestAction ?? "Sem próxima ação sugerida"}</span></span> },
  ];
}

export function NegotiationStatsView({ brokerStats, dailyStats, aiHealth }: { brokerStats: NegotiationBrokerStats[]; dailyStats: NegotiationDayStats[]; aiHealth: NegotiationsDashboardData["aiHealth"] }) {
  const brokerColumns: LiteColumn<NegotiationBrokerStats>[] = [
    { id: "broker", label: "Corretor", primary: true, render: (row) => row.brokerName },
    { id: "total", label: "Leads ativos", numeric: true, render: (row) => formatNegotiationMetric(row.total) },
    { id: "closing", label: "Fechamento", numeric: true, render: (row) => formatNegotiationMetric(row.levels.closing) },
    { id: "advanced", label: "Avançada", numeric: true, render: (row) => formatNegotiationMetric(row.levels.advanced) },
    { id: "conversation", label: "Em conversa", numeric: true, render: (row) => formatNegotiationMetric(row.levels.in_conversation) },
    { id: "cooling", label: "Esfriando", numeric: true, render: (row) => formatNegotiationMetric(row.levels.cooling) },
    { id: "noCrm", label: "Sem conversa no CRM", numeric: true, render: (row) => formatNegotiationMetric(row.levels.no_crm_conversation) },
    { id: "waiting", label: "Clientes aguardando", numeric: true, render: (row) => formatNegotiationMetric(row.customersWaiting) },
    { id: "first", label: "1ª resposta", nowrap: true, render: (row) => formatDuration(row.averageFirstResponseSeconds) },
    { id: "reply", label: "Resposta ao cliente", nowrap: true, render: (row) => formatDuration(row.averageReplySeconds) },
    { id: "crm", label: "Com conversa no CRM", numeric: true, render: (row) => `${formatNegotiationMetric(row.crmConversationPercent)}%` },
  ];
  const dailyColumns: LiteColumn<NegotiationDayStats>[] = [
    { id: "day", label: "Dia", primary: true, render: (row) => row.label },
    { id: "exchange", label: "Leads com troca", numeric: true, render: (row) => formatNegotiationMetric(row.leadsWithExchange) },
    { id: "messages", label: "Mensagens do corretor", numeric: true, render: (row) => formatNegotiationMetric(row.brokerMessages) },
    { id: "advanced", label: "Em avançada (atual)", numeric: true, render: (row) => formatNegotiationMetric(row.currentlyAdvanced) },
    { id: "closing", label: "Em fechamento (atual)", numeric: true, render: (row) => formatNegotiationMetric(row.currentlyClosing) },
  ];

  return (
    <div className={styles.statsBlock}>
      <section className={styles.statsBlock} aria-labelledby="negotiations-brokers-title">
        <h2 className={styles.sectionTitle} id="negotiations-brokers-title">Por corretor</h2>
        <LiteResponsiveData caption="Estatísticas de negociações por corretor" columns={brokerColumns} rows={brokerStats} rowKey={(row) => row.brokerId} empty={<p className={styles.emptyText}>Ainda não há negociações ativas neste escopo.</p>} />
      </section>
      <section className={styles.statsBlock} aria-labelledby="negotiations-days-title">
        <h2 className={styles.sectionTitle} id="negotiations-days-title">Últimos 7 dias</h2>
        <p className={styles.sectionHint}>Leads que hoje seguem nesses níveis, agrupados pelo dia de entrada na etapa.</p>
        <LiteResponsiveData caption="Atividade diária de negociação" columns={dailyColumns} rows={dailyStats} rowKey={(row) => row.day} empty={<p className={styles.emptyText}>Sem atividade registrada no período.</p>} />
      </section>
      <section className={styles.statsBlock} aria-labelledby="negotiations-health-title">
        <h2 className={styles.sectionTitle} id="negotiations-health-title">Saúde da IA</h2>
        <div className={styles.healthRow}>
          <div className={styles.healthItem}>
            <span className={styles.healthLabel}>Análises nas últimas 24 horas</span>
            <span className={styles.healthValue}>{formatNegotiationMetric(aiHealth.analysesLast24Hours)}</span>
          </div>
          <div className={styles.healthItem} data-tone={aiHealth.failuresLast24Hours > 0 ? "danger" : undefined}>
            <span className={styles.healthLabel}>Falhas nas últimas 24 horas</span>
            <span className={styles.healthValue}>{formatNegotiationMetric(aiHealth.failuresLast24Hours)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export { KPI_ITEMS, LEVEL_LABELS };
