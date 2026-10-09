import type { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import type { getDutyOccurrenceHistory } from "./duty-occurrence-history";
import type { DutyWindow } from "./duty-presence-domain";
import type { BrokerLiveOfferStatus } from "./duty-roster-live-status";
import type { DutyScheduleReportInput } from "./duty-schedule-pdf";
import { getDutyCoverage } from "./domain";
import { groupDutyLeadsByShift } from "./duty-leads-shift-groups";
import { leadDistributionStatusUi } from "./status-ui";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

type DutyScheduleProfile = Awaited<ReturnType<typeof getDutyScheduleProfile>>;

const DAYS_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

// Static wording for a printed snapshot — the page's live badge counts down instead.
const LIVE_STATUS_LABELS: Record<BrokerLiveOfferStatus, string> = {
  paused: "Pausado",
  ready: "Pronto para receber",
  offer_pending: "Oferta aguardando resposta",
  cooldown: "Aguardando intervalo entre ofertas",
  capacity_full: "Limite da fila atingido",
  blocked: "Indisponível",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function dutyReportPeriodLabel(since: Date, until: Date | null, upcomingStartsAt: Date | null = null) {
  if (since.getTime() === 0) return "Desde a criação do plantão";
  if (upcomingStartsAt) return `Ocorrência desde ${dateTime.format(since)} (inicia às ${timeOnly.format(upcomingStartsAt)})`;
  return until ? `Ocorrência de ${dateTime.format(since)} a ${dateTime.format(until)}` : `Ocorrência desde ${dateTime.format(since)} (em andamento)`;
}

/** Maps the same profile the plantão page renders into the PDF report rows. */
export function buildDutyScheduleReport(
  profile: DutyScheduleProfile,
  returnedUnaccepted: ReadonlySet<string>,
  leadsLimit: number,
): Omit<DutyScheduleReportInput, "tenantName" | "tenantLogoUrl" | "generatedAt"> {
  const { schedule, roster, linkedQueues, leads, leadsSince, leadsUntil, leadsUpcomingStartsAt, presenceEnabled, liveStatusEnabled } = profile;
  const isDistributed = (lead: (typeof leads)[number]) => Boolean(lead.corretorId) && lead.distributionStatus === "assigned";
  const distributedCount = leads.filter(isDistributed).length;
  const coverage = getDutyCoverage(roster.length, schedule.minimumBrokers);
  const confirmedCount = roster.filter((entry) => entry.presenceStatus === "confirmed").length;
  const readyCount = roster.filter((entry) => entry.liveStatus === "ready").length;

  const summary = [
    { label: "Leads recebidos", value: String(leads.length) },
    { label: "Distribuídos", value: String(distributedCount) },
    { label: "Aguardando distribuição", value: String(leads.length - distributedCount) },
    { label: "Devolvidos sem aceite", value: String(leads.filter((lead) => returnedUnaccepted.has(lead.id)).length) },
    { label: "Cobertura da escala", value: `${coverage.assigned}/${coverage.minimum}` },
    presenceEnabled
      ? { label: "Presença confirmada", value: `${confirmedCount}/${roster.length}` }
      : liveStatusEnabled
        ? { label: "Prontos para receber", value: `${readyCount}/${roster.length}` }
        : { label: "Corretores escalados", value: String(roster.length) },
  ];

  const queueNames = linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : schedule.queueName;
  const scheduleDetails = [
    schedule.branchName ?? "Todas as unidades",
    queueNames,
    `${DAYS_FULL[schedule.dayOfWeek]} ${schedule.startsAt.slice(0, 5)} às ${schedule.endsAt.slice(0, 5)} (${schedule.timezone})`,
  ].filter(Boolean).join(" · ");

  return {
    scheduleName: schedule.name,
    scheduleDetails,
    periodLabel: dutyReportPeriodLabel(leadsSince, leadsUntil, leadsUpcomingStartsAt),
    summary,
    brokers: roster.map((entry) => ({
      code: entry.internalCode ?? "-",
      name: entry.brokerName,
      presence: !presenceEnabled
        ? "Não exigida"
        : entry.presenceStatus === "confirmed"
          ? `Confirmada${entry.confirmedAt ? ` às ${timeOnly.format(entry.confirmedAt)}` : ""}`
          : entry.presenceStatus === "pending" ? "Pendente" : "-",
      situation: entry.blockedReason ?? (entry.pausedAt ? "Pausado" : liveStatusEnabled ? LIVE_STATUS_LABELS[entry.liveStatus] : "Escalado"),
      situationAlert: Boolean(entry.blockedReason),
      leadsInWindow: entry.leadsInWindow,
      activeLeads: entry.activeLeads,
      capacity: entry.capacity,
    })),
    leadGroups: groupDutyLeadsByShift(leads).map((group) => ({
      label: group.label,
      leads: group.leads.map((lead) => ({
        name: lead.nome,
        phone: lead.telefone ?? "",
        queue: lead.queueName ?? "",
        broker: lead.brokerName ?? "Sem corretor",
        returnedUnaccepted: returnedUnaccepted.has(lead.id),
        distribution: leadDistributionStatusUi(lead.distributionStatus).label,
        stage: LEAD_STATUS_LABELS[lead.status] ?? lead.status,
        receivedAt: lead.createdAt,
        assignedAt: lead.assignedAt && lead.corretorId ? lead.assignedAt : null,
      })),
    })),
    leadsTruncatedAt: leads.length >= leadsLimit ? leadsLimit : null,
  };
}

type DutyOccurrenceHistory = Awaited<ReturnType<typeof getDutyOccurrenceHistory>>;

/** PDF of one finished occurrence: what happened in it, with the leads each broker received. */
export function buildDutyOccurrenceHistoryReport(
  profile: Pick<DutyScheduleProfile, "schedule" | "linkedQueues">,
  window: DutyWindow,
  history: DutyOccurrenceHistory,
  codes: ReadonlyMap<string, string | null>,
): Omit<DutyScheduleReportInput, "tenantName" | "tenantLogoUrl" | "generatedAt"> {
  const { schedule, linkedQueues } = profile;
  const queueNames = linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : schedule.queueName;
  return {
    scheduleName: schedule.name,
    scheduleDetails: [
      schedule.branchName ?? "Todas as unidades",
      queueNames,
      `${DAYS_FULL[schedule.dayOfWeek]} ${schedule.startsAt.slice(0, 5)} às ${schedule.endsAt.slice(0, 5)} (${schedule.timezone})`,
    ].filter(Boolean).join(" · "),
    periodLabel: `Turno encerrado de ${dateTime.format(window.startsAt)} a ${dateTime.format(window.endsAt)}`,
    summary: [
      { label: "Leads atribuídos", value: String(history.distributions.length) },
      { label: "Ofertas enviadas", value: String(history.offers.total) },
      { label: "Ofertas aceitas", value: String(history.offers.accepted) },
      { label: "Recusadas / expiradas", value: `${history.offers.declined} / ${history.offers.expired}` },
      { label: "Corretores escalados", value: String(history.roster.length) },
      { label: "Presença confirmada", value: `${history.confirmations.confirmed}/${history.confirmations.total}` },
    ],
    brokers: history.brokers.map((entry) => ({
      code: codes.get(entry.brokerId) ?? "-",
      name: entry.brokerName,
      presence: "-",
      situation: [entry.branchName ?? "Sem unidade", entry.onRoster ? null : "fora da escala"].filter(Boolean).join(" · "),
      situationAlert: !entry.onRoster,
      leadsInWindow: entry.leads,
      activeLeads: null,
      capacity: null,
    })),
    leadGroups: [{
      label: "Leads distribuídos no turno",
      leads: history.distributions.map((entry) => ({
        name: entry.leadName,
        phone: "",
        queue: "",
        broker: entry.brokerName,
        returnedUnaccepted: false,
        distribution: entry.kind,
        stage: entry.exact ? "Vínculo confirmado" : "Estimado pela fila",
        receivedAt: entry.assignedAt,
        assignedAt: entry.assignedAt,
      })),
    }],
    leadsTruncatedAt: history.truncated ? history.distributions.length : null,
  };
}
