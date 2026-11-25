import { importedFirstContactHours, isTeamListLead } from "@/features/broker-workspace/imported-first-contact";
import { resolveFirstContactSla } from "@/features/broker-workspace/priority";

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
  latestMessageAt?: Date | null;
  hasAnyMessage?: boolean;
  slaMinutes: number;
  now: Date;
}): SupervisorPendingItem | null {
  const imported = isTeamListLead(input.sourceChannel);
  const hours = imported ? importedFirstContactHours(input.sourceMetadata) : null;
  const sla = resolveFirstContactSla({
    status: input.status,
    sourceChannel: input.sourceChannel,
    importedFirstContactHours: hours,
    assignedAt: input.assignedAt,
    firstContactAt: input.firstContactAt,
    stageEnteredAt: input.stageEnteredAt,
    hasAnyMessage: input.hasAnyMessage ?? Boolean(input.latestMessageAt),
    slaFirstContactMinutes: input.slaMinutes,
    now: input.now,
  });
  if (!sla || sla.state !== "overdue") return null;
  const elapsedMinutes = Math.max(0, Math.floor((input.now.getTime() - sla.dueAt.getTime()) / 60_000));
  return {
    id: `first-contact:${input.leadId}`,
    reason: "first_contact_overdue",
    leadId: input.leadId,
    leadName: input.name,
    brokerId: input.brokerId,
    brokerName: input.brokerName,
    dueAt: sla.dueAt.toISOString(),
    detail: sla.imported
      ? `Sem primeiro contato ap\u00f3s ${hours ?? 24} h da lista importada \u00b7 ${elapsedMinutes} min vencido`
      : `Sem primeiro contato ap\u00f3s o SLA \u00b7 ${elapsedMinutes} min vencido`,
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

export function groupSupervisorPendencies(items: SupervisorPendingItem[], maxItemsPerReason = 50) {
  const order: SupervisorPendingReason[] = ["offer_waiting", "first_contact_overdue", "return_overdue"];
  return order.flatMap((reason) => {
    const groupItems = items.filter((item) => item.reason === reason).sort((left, right) => {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : 0;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : 0;
      return leftDue - rightDue || left.leadName.localeCompare(right.leadName, "pt-BR");
    });
    return groupItems.length ? [{ reason, count: groupItems.length, items: groupItems.slice(0, maxItemsPerReason) }] : [];
  });
}
