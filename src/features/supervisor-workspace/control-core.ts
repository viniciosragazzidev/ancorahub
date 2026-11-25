import { importedFirstContactDueAt, importedFirstContactHours, isImportedLeadPending, isTeamListLead } from "@/features/broker-workspace/imported-first-contact";

export type SupervisorPendingReason = "offer_waiting" | "first_contact_overdue" | "return_overdue";

export type SupervisorPendingItem = {
  id: string;
  reason: SupervisorPendingReason;
  leadId: string;
  leadName: string;
  brokerId: string;
  brokerName: string;
  dueAt: string | null;
  detail: string;
};

const ACTIONABLE_OFFER_STATUSES = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);

export function isOfferActionable(input: { status: string; offeredAt: Date; expiresAt: Date; leadStatus: string; currentOwnerId: string | null; brokerId: string; now: Date }) {
  return ACTIONABLE_OFFER_STATUSES.has(input.status)
    && input.expiresAt.getTime() > input.now.getTime()
    && input.offeredAt.getTime() <= input.now.getTime() - 5 * 60_000
    && ["new", "distributed"].includes(input.leadStatus)
    && input.currentOwnerId === input.brokerId;
}

export function isReturnTaskOverdue(input: { title: string; dueAt: Date | null; completedAt: Date | null; now: Date }) {
  return !input.completedAt
    && Boolean(input.dueAt && input.dueAt.getTime() < input.now.getTime())
    && /retorn|follow/i.test(input.title);
}

export function classifyFirstContact(input: {
  leadId: string;
  name: string;
  brokerId: string;
  brokerName: string;
  status: string;
  sourceChannel: string | null;
  sourceMetadata: unknown;
  assignedAt: Date | null;
  firstContactAt: Date | null;
  stageEnteredAt: Date | null;
  latestMessageAt: Date | null;
  slaMinutes: number;
  now: Date;
}): SupervisorPendingItem | null {
  const teamList = isTeamListLead(input.sourceChannel);
  // A lista da equipe entra em atendimento já na distribuição. Ela tem o prazo próprio
  // e só deixa de ser pendência quando houver contato ou avanço de etapa.
  if (!input.assignedAt || (teamList ? input.status !== "in_contact" : !["new", "distributed"].includes(input.status))) return null;
  const recordedContact = input.firstContactAt ?? input.latestMessageAt ?? (teamList && input.status !== "in_contact" ? input.stageEnteredAt : null);
  if (recordedContact) return null;

  if (teamList) {
    const hours = importedFirstContactHours(input.sourceMetadata);
    if (!isImportedLeadPending({ assignedAt: input.assignedAt, contacted: false, hours, now: input.now })) return null;
    const dueAt = importedFirstContactDueAt(input.assignedAt, hours);
    const elapsedMinutes = Math.max(0, Math.floor((input.now.getTime() - (dueAt?.getTime() ?? input.now.getTime())) / 60_000));
    return {
      id: `first-contact:${input.leadId}`,
      reason: "first_contact_overdue",
      leadId: input.leadId,
      leadName: input.name,
      brokerId: input.brokerId,
      brokerName: input.brokerName,
      dueAt: dueAt?.toISOString() ?? null,
      detail: `Sem primeiro contato após ${hours} h da lista importada · ${elapsedMinutes} min vencido`,
    };
  }

  const dueAt = new Date(input.assignedAt.getTime() + Math.max(1, input.slaMinutes) * 60_000);
  if (dueAt.getTime() > input.now.getTime()) return null;
  const elapsedMinutes = Math.max(0, Math.floor((input.now.getTime() - dueAt.getTime()) / 60_000));
  return {
    id: `first-contact:${input.leadId}`,
    reason: "first_contact_overdue",
    leadId: input.leadId,
    leadName: input.name,
    brokerId: input.brokerId,
    brokerName: input.brokerName,
    dueAt: dueAt.toISOString(),
    detail: `Sem primeiro contato após o SLA · ${elapsedMinutes} min vencido`,
  };
}

export function isShiftActiveNow(startsAt: string, endsAt: string, nowTime: string, paused: boolean) {
  if (paused) return false;
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  };
  const start = toMinutes(startsAt);
  const end = toMinutes(endsAt);
  const current = toMinutes(nowTime);
  return end >= start ? current >= start && current < end : current >= start || current < end;
}

export function groupSupervisorPendencies(items: SupervisorPendingItem[]) {
  const order: SupervisorPendingReason[] = ["offer_waiting", "first_contact_overdue", "return_overdue"];
  return order.flatMap((reason) => {
    const groupItems = items.filter((item) => item.reason === reason).sort((left, right) => {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : 0;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : 0;
      return leftDue - rightDue || left.leadName.localeCompare(right.leadName, "pt-BR");
    });
    return groupItems.length ? [{ reason, count: groupItems.length, items: groupItems }] : [];
  });
}
