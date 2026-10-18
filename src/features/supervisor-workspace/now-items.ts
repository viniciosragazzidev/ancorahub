import type { HomeNowItem } from "@/components/chat/types";
import { formatBrokerArrival } from "@/features/broker-workspace/arrival";
import type { SupervisorWorkspaceData } from "./queries";

const TIME_ZONE = "America/Sao_Paulo";

function localDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const presenceLabel: Record<SupervisorWorkspaceData["duty"][number]["presence"], string> = {
  confirmed: "presença confirmada",
  pending: "não confirmou presença",
  absent: "marcou ausência",
  expired: "prazo de confirmação encerrou",
  not_required: "sem confirmação obrigatória",
};

/** Leads recentes, primeiro contato vencido e escala de hoje em um só lugar. */
export function buildSupervisorNowItems(data: SupervisorWorkspaceData, now = new Date()): HomeNowItem[] {
  const items: HomeNowItem[] = [];
  const today = localDayKey(now);
  const recentlyAssigned = data.attention
    .filter((lead) => lead.assignedAt && localDayKey(lead.assignedAt) === today && !lead.late)
    .sort((left, right) => (right.assignedAt?.getTime() ?? 0) - (left.assignedAt?.getTime() ?? 0))
    .slice(0, 2);

  for (const lead of recentlyAssigned) {
    const arrival = formatBrokerArrival(lead.assignedAt, now);
    items.push({
      id: `new-${lead.leadId}`,
      title: lead.name,
      detail: `Recebido ${arrival} · com ${firstName(lead.brokerName)}`,
      actionLabel: "Repassar",
      href: `/equipe/repassar?lead=${encodeURIComponent(lead.leadId)}`,
      tone: "normal",
    });
  }

  const lateLeads = data.attention
    .filter((lead) => lead.late)
    .sort((left, right) => (left.assignedAt?.getTime() ?? 0) - (right.assignedAt?.getTime() ?? 0))
    .slice(0, 3);
  for (const lead of lateLeads) {
    const owner = firstName(lead.brokerName);
    const href = lead.brokerId
      ? `/relacionamento?brokerId=${encodeURIComponent(lead.brokerId)}&leadId=${encodeURIComponent(lead.leadId)}&action=reminder`
      : `/equipe/repassar?lead=${encodeURIComponent(lead.leadId)}`;
    items.push({
      id: `late-${lead.leadId}`,
      title: lead.name,
      detail: `Primeiro contato atrasado · ${owner}`,
      actionLabel: lead.brokerId ? `Cobrar ${owner}` : "Repassar",
      href,
      tone: "urgent",
    });
  }

  const todayDuty = [...data.duty].sort((left, right) => {
    const leftUnconfirmed = left.presence === "pending" || left.presence === "absent" || left.presence === "expired";
    const rightUnconfirmed = right.presence === "pending" || right.presence === "absent" || right.presence === "expired";
    return Number(rightUnconfirmed) - Number(leftUnconfirmed) || left.startsAt.localeCompare(right.startsAt) || left.brokerName.localeCompare(right.brokerName);
  });
  for (const duty of todayDuty.slice(0, 4)) {
    items.push({
      id: `duty-${duty.assignmentId ?? `${duty.brokerId}-${duty.scheduleName}`}`,
      title: `${duty.brokerName} · ${duty.scheduleName}`,
      detail: `${duty.startsAt} às ${duty.endsAt}${duty.paused ? " · pausado" : ""} · ${presenceLabel[duty.presence]}`,
      actionLabel: "Ver plantão",
      href: `/plantoes/corretor/${encodeURIComponent(duty.brokerId)}`,
      tone: duty.presence === "pending" || duty.presence === "absent" || duty.presence === "expired" ? "warning" : "normal",
    });
  }
  if (todayDuty.length > 4) {
    items.push({
      id: "duty-more",
      title: `Mais ${todayDuty.length - 4} pessoas na escala de hoje`,
      detail: "Veja todos os horários e confirmações da equipe.",
      actionLabel: "Ver plantão",
      href: "/equipe/plantao",
      tone: "normal",
    });
  }

  return items;
}
