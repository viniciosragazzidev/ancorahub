import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { DirectorDistributionTabs } from "@/app/(dashboard)/leads/distribuicao/_components/director-distribution-tabs";
import { DistributionInbox } from "@/app/(dashboard)/leads/distribuicao/_components/distribution-inbox";
import { DistributionMetrics } from "@/app/(dashboard)/leads/distribuicao/_components/distribution-dashboard";
import { QueueControlCenter } from "@/app/(dashboard)/leads/distribuicao/_components/queue-control-center";
import { DirectorDistributionHealth } from "@/app/(dashboard)/leads/distribuicao/_components/director-distribution-health";
import { DirectorDistributionDashboard } from "@/app/(dashboard)/distribuicao/_components/director-distribution-dashboard";
import { DirectorDutyLeads, type DutyLeadRecord } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/director-duty-leads";
import { DirectorDutyHeaderActions } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/director-duty-header-actions";
import { Onda5CalendarFixture } from "./onda5-calendar-fixture";
import styles from "./onda5-styles.module.css";

type PreviewContext = { role: string; jobTitle: string | null; branchId: string | null };
type Screen = { path: string; render: (context: PreviewContext) => ReactNode };

const branches = [
  { id: "branch-centro", name: "Unidade Centro" },
  { id: "branch-norte", name: "Unidade Zona Norte" },
  { id: "branch-sul", name: "Unidade Sul" },
];

const brokers = [
  { id: "broker-1", name: "Ana Carolina de Souza", branchId: "branch-centro", availabilityStatus: "available" as const, activeLeads: 3 },
  { id: "broker-2", name: "João Pedro Albuquerque", branchId: "branch-norte", availabilityStatus: "paused" as const, activeLeads: 5 },
  { id: "broker-3", name: "Mariana Fernanda Costa", branchId: "branch-sul", availabilityStatus: "available" as const, activeLeads: 2 },
  { id: "broker-4", name: "Rafael Henrique de Oliveira", branchId: "branch-centro", availabilityStatus: "offline" as const, activeLeads: 0 },
];

const inboxLeads = Array.from({ length: 40 }, (_, index) => ({
  id: `lead-demo-${index + 1}`,
  name: [
    "Mariana de Albuquerque Costa e Silva",
    "João Pedro de Oliveira Nascimento",
    "Ana Beatriz Ferreira de Almeida",
    "Rafael Henrique dos Santos Carvalho",
  ][index % 4]!,
  phone: `+55119999${String(1000 + index).slice(-4)}`,
  branchId: branches[index % branches.length]!.id,
  distributionStatus: index % 7 === 0 ? "returned_to_queue" : index % 5 === 0 ? "queued" : "unassigned",
  status: "new",
  qualificationStatus: index % 3 === 0 ? "hot" : index % 3 === 1 ? "warm" : "cold",
  createdAt: new Date(Date.UTC(2026, 9, 25, 13 + (index % 8), index * 3 % 60)).toISOString(),
  sourceCampaign: `Campanha de outubro ${index % 5 + 1}`,
  sourceAd: `Anúncio ${index % 4 + 1}`,
  metaCampaignId: `campaign-${index % 5 + 1}`,
  metaAdId: `ad-${index % 4 + 1}`,
}));

const queues = Array.from({ length: 6 }, (_, index) => ({
  id: `queue-${index + 1}`,
  name: ["Fila Premium · Centro", "Fila PF · Zona Norte", "Fila PME · Centro", "Fila Saúde Familiar · Sul", "Fila Retorno · Centro", "Fila de Anúncios · Zona Norte"][index]!,
  branchId: branches[index % branches.length]!.id,
  branchName: branches[index % branches.length]!.name,
  status: "active",
  assignmentMode: index === 4 ? "manual" : "automatic",
  assignmentStrategy: index % 2 ? "round_robin" : "capacity",
  capacityEnabled: true,
  capacityPerBroker: 12,
  offerIntervalMinutes: 5 + index,
  maxPendingOffersPerBroker: 2,
  aiQualificationEnabled: true,
  holdColdLeads: index === 1,
  coldLeadRequalification: { enabled: index === 1, intervalMinutes: 120, maxAttempts: 3 },
  waiting: 7 + index * 3,
  members: 4 + index,
  activeLeads: 18 + index * 4,
  colorHue: 205 + index * 15,
}));

const dutySchedules = [
  { id: "duty-centro-manha", name: "PRESENCIAL MANHÃ · Centro", startsAt: "08:30", endsAt: "13:30", dayOfWeek: 1, branchName: "Unidade Centro" },
  { id: "duty-centro-tarde", name: "PRESENCIAL TARDE · Centro", startsAt: "13:30", endsAt: "19:00", dayOfWeek: 1, branchName: "Unidade Centro" },
  { id: "duty-norte-manha", name: "PRESENCIAL MANHÃ · Zona Norte", startsAt: "08:00", endsAt: "13:00", dayOfWeek: 1, branchName: "Unidade Zona Norte" },
  { id: "duty-sul-integral", name: "Plantão integral · Unidade Sul", startsAt: "09:00", endsAt: "18:00", dayOfWeek: 1, branchName: "Unidade Sul" },
];

const campaigns = Array.from({ length: 6 }, (_, index) => ({ campaignId: `campaign-${index + 1}`, name: `Campanha ${index + 1} · ${branches[index % branches.length]!.name}`, status: "ACTIVE" }));
const ads = Array.from({ length: 12 }, (_, index) => ({ adId: `ad-${index + 1}`, name: `Anúncio de seguro ${index + 1}`, status: "ACTIVE", campaignId: `campaign-${index % campaigns.length + 1}` }));
const campaignRoutes = campaigns.map((campaign, index) => ({ campaignId: campaign.campaignId, queueId: queues[index % queues.length]!.id, queueName: queues[index % queues.length]!.name, enabled: true }));
const adRoutes = ads.map((ad, index) => ({ adId: ad.adId, queueId: queues[index % queues.length]!.id, queueName: queues[index % queues.length]!.name, enabled: index % 5 !== 0 }));

const leadRows: DutyLeadRecord[] = inboxLeads.map((lead, index) => {
  const createdAt = lead.createdAt;
  const assignedAt = index % 3 ? new Date(Date.parse(createdAt) + 5 * 60_000).toISOString() : null;
  const broker = index % 3 ? brokers[index % brokers.length]! : null;
  const branch = branches[index % branches.length]!;
  const queue = queues[index % queues.length]!;
  return {
    lead: {
      id: lead.id,
      nome: lead.name,
      telefone: lead.phone,
      status: "new",
      qualificationStatus: lead.qualificationStatus!,
      qualificationState: "COMPLETED",
      distributionStatus: broker ? "assigned" : "queued",
      origem: "Meta Lead Ads",
      sourceCampaign: lead.sourceCampaign,
      sourceMetadata: { campaign: lead.metaCampaignId, ad: lead.metaAdId },
      tipo: "PF",
      createdAt,
      assignedAt,
      stageEnteredAt: null,
      serviceStartedAt: null,
      firstContactAt: null,
      corretorId: broker?.id ?? null,
      corretorNome: broker?.name ?? null,
      branchId: branch.id,
      branchName: branch.name,
      qualificationDetails: { familySize: 3, waitPeriod: "sem prazo" },
      queueId: queue.id,
      queueName: queue.name,
      queueColorHue: queue.colorHue,
      distributionRemovalReason: null,
      distributionRemovalNote: null,
    },
    groupKey: index < 20 ? "manha" : "tarde",
    groupLabel: index < 20 ? "Turno da manhã · 20 leads" : "Turno da tarde · 20 leads",
    createdAt,
    assignedAt,
    brokerName: broker?.name ?? null,
    queueName: queue.name,
    distributionLabel: broker ? "Atribuído" : "Aguardando",
    distributionTone: broker ? "success" : "warning",
    whatsappLabel: `Campanha ${index % campaigns.length + 1}`,
    returnedUnaccepted: index % 7 === 0,
    coldHeld: lead.qualificationStatus === "cold" && index % 2 === 0,
  };
});

function Tabs({ activeView, role }: { activeView: string; role: string }) {
  return <DirectorDistributionTabs activeView={activeView} showQueues={role === "director"} escalaMes="2026-10" />;
}

function OperationScreen({ role }: PreviewContext) {
  return <><DashboardHeader breadcrumb="Operação comercial" title="Distribuição" /><main className={styles.page}><Tabs activeView="operar" role={role} /><div className={styles.stack}><DistributionMetrics metrics={{ totalBranches: 3, acceptingBranches: 3, autoDistributeBranches: 2, totalBrokers: 16, totalAvailable: 11, totalNewLeads: 40 }} /><DistributionInbox role={role} manualAssignmentChoiceEnabled totalUnassigned={40} branches={branches} brokers={brokers} leads={inboxLeads} /></div></main></>;
}

function QueueScreen({ role }: PreviewContext) {
  return <><DashboardHeader breadcrumb="Operação comercial" title="Distribuição" /><main className={styles.page}><Tabs activeView="filas" role={role} /><div className={styles.stack}><QueueControlCenter queues={queues} branches={branches} brokers={brokers.map(({ id, name, branchId, availabilityStatus, activeLeads }) => ({ id, name, branchId, branchName: branches.find((branch) => branch.id === branchId)?.name ?? null, activeLeads, availabilityStatus }))} dutySchedules={dutySchedules} campaigns={campaigns} ads={ads} campaignRoutes={campaignRoutes} adRoutes={adRoutes} attendanceFlows={[]} canEdit={role === "director"} /></div></main></>;
}

function CalendarScreen({ role }: PreviewContext) {
  return <><DashboardHeader breadcrumb="Operação comercial" title="Distribuição" /><main className={styles.page}><Tabs activeView="plantao" role={role} /><div className={styles.stack}><Onda5CalendarFixture /></div></main></>;
}

function ScheduleScreen({ role, jobTitle, branchId }: PreviewContext) {
  const groups = [
    { key: "manha", label: "Turno da manhã · 20 leads", leads: leadRows.slice(0, 20) },
    { key: "tarde", label: "Turno da tarde · 20 leads", leads: leadRows.slice(20) },
  ];
  return <><DashboardHeader breadcrumb="Distribuição · Plantões" title="PRESENCIAL TARDE · Unidade Centro" /><main className={styles.page}><div className={styles.toolbar}><DirectorDutyHeaderActions scheduleId="demo-schedule" canExport={false} /></div><section className={styles.section}><h2>Leads deste plantão</h2><DirectorDutyLeads groups={groups} brokers={brokers.map(({ id, name, branchId }) => ({ id, name, branchId }))} branches={branches} contextRole={role} contextJobTitle={jobTitle} contextBranchId={branchId} manualAssignmentChoiceEnabled slaFirstContactMinutes={15} slaStagnantDays={3} empty="Nenhum lead nesta ordem." /></section></main></>;
}

function HealthScreen({ role }: PreviewContext) {
  const events = Array.from({ length: 18 }, (_, index) => ({ id: `event-${index}`, leadName: leadRows[index]!.lead.nome, brokerName: brokers[index % brokers.length]!.name, queueName: queues[index % queues.length]!.name, action: index % 2 ? "lead_assigned" : "lead_returned_to_queue", reason: index % 3 ? null : "Tempo de aceite expirado", createdAt: new Date(Date.UTC(2026, 9, 25, 16 - Math.floor(index / 3), index * 4)).toISOString() }));
  return <><DashboardHeader breadcrumb="Operação comercial" title="Distribuição" /><main className={styles.page}><Tabs activeView="saude_historico" role={role} /><div className={styles.stack}><DirectorDistributionHealth events={events} jobs={{ pending: 8, retrying: 2, processing: 1, failed: 1, completed: 124 }} jobsAvailable jobsEnabled effects={{ pending: 2, retrying: 1, processing: 0, failed: 1, completed: 123 }} failedEffects={[{ id: "effect-1", leadName: "Mariana de Albuquerque Costa e Silva", type: "notify_broker", attemptCount: 3, lastErrorCode: "provider_timeout", lastErrorMessage: "Tempo limite do provedor" }]} /></div></main></>;
}

function OverviewScreen() {
  return <><DashboardHeader breadcrumb="Distribuição" title="Visão geral" /><main className={styles.page}><DirectorDistributionDashboard data={{ title: "Visão de distribuição", description: "Fluxo de leads no período.", metrics: [{ label: "Recebidos", value: 1248 }, { label: "Atribuídos", value: 1036 }], actionHref: "/distribuicao" }} /></main></>;
}

export const ONDA5_SCREENS: Record<string, Screen> = {
  "distribuicao-operar": { path: "/distribuicao", render: (context) => <OperationScreen {...context} /> },
  "distribuicao-filas": { path: "/distribuicao", render: (context) => <QueueScreen {...context} /> },
  "distribuicao-plantao": { path: "/distribuicao", render: (context) => <CalendarScreen {...context} /> },
  "distribuicao-ocorrencia": { path: "/leads/distribuicao/plantao/demo-schedule", render: (context) => <ScheduleScreen {...context} /> },
  "distribuicao-saude": { path: "/distribuicao", render: (context) => <HealthScreen {...context} /> },
  "distribuicao-dashboard": { path: "/distribuicao/dashboard", render: () => <OverviewScreen /> },
};
