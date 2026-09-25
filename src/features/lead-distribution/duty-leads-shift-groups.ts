export type DutyLeadShift = "manha" | "tarde";

export type DutyLeadShiftGroup<T> = {
  key: DutyLeadShift;
  label: string;
  leads: T[];
};

/** Leads assigned (or, when never assigned, received) from 13:00 on belong to the afternoon block. */
export const AFTERNOON_CUTOFF_HOUR = 13;

const SHIFT_LABELS: Record<DutyLeadShift, string> = {
  manha: "Manhã · até 12:59",
  tarde: "Tarde · a partir de 13:00",
};

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Operational hour in São Paulo — the server may run in UTC. */
function saoPauloHour(date: Date) {
  return Number(hourFormatter.formatToParts(date).find((part) => part.type === "hour")?.value ?? 0);
}

export function getDutyLeadShift(lead: { assignedAt: Date | null; corretorId: string | null; createdAt: Date }): DutyLeadShift {
  const reference = lead.assignedAt && lead.corretorId ? lead.assignedAt : lead.createdAt;
  return saoPauloHour(reference) >= AFTERNOON_CUTOFF_HOUR ? "tarde" : "manha";
}

/**
 * Distributed leads in the order they were handed to brokers: earliest
 * assignment first, arrival time as the tie-break (and for any row that
 * somehow lacks an assignment time, which then sorts last).
 */
export function sortByAssignmentTime<T extends { assignedAt: Date | null; createdAt: Date }>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const aAssigned = a.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bAssigned = b.assignedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/** Splits leads into morning/afternoon blocks, keeping their order and omitting empty blocks. */
export function groupDutyLeadsByShift<T extends { assignedAt: Date | null; corretorId: string | null; createdAt: Date }>(
  leads: T[],
): DutyLeadShiftGroup<T>[] {
  const groups: DutyLeadShiftGroup<T>[] = (["manha", "tarde"] as const).map((key) => ({ key, label: SHIFT_LABELS[key], leads: [] }));
  for (const lead of leads) groups[getDutyLeadShift(lead) === "manha" ? 0 : 1].leads.push(lead);
  return groups.filter((group) => group.leads.length > 0);
}
