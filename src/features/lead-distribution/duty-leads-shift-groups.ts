export type DutyLeadShift = "manha" | "tarde";

export type DutyLeadShiftGroup<T> = {
  key: DutyLeadShift;
  label: string;
  leads: T[];
};

/** Leads assigned (or, when never assigned, received) from 13:00 on belong to the afternoon block. */
export const AFTERNOON_CUTOFF_HOUR = 13;

/** "Manhã · até 12:59" / "Tarde · a partir de 13:00", or the plantão's own split ("13:30"). */
function shiftLabels(splitAt?: string | null): Record<DutyLeadShift, string> {
  const cutoff = splitMinutes(splitAt);
  const last = cutoff - 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    manha: `Manhã · até ${pad(Math.floor(last / 60))}:${pad(last % 60)}`,
    tarde: `Tarde · a partir de ${pad(Math.floor(cutoff / 60))}:${pad(cutoff % 60)}`,
  };
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Operational time of day in São Paulo, in minutes — the server may run in UTC. */
function saoPauloMinutes(date: Date) {
  const parts = timeFormatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (value("hour") % 24) * 60 + value("minute");
}

/** The afternoon starts at the plantão's split ("13:30"), or at 13:00 for a plantão with one shift. */
function splitMinutes(splitAt?: string | null) {
  const match = splitAt?.match(/^(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : AFTERNOON_CUTOFF_HOUR * 60;
}

export function getDutyLeadShift(lead: { assignedAt: Date | null; corretorId: string | null; createdAt: Date }, splitAt?: string | null): DutyLeadShift {
  const reference = lead.assignedAt && lead.corretorId ? lead.assignedAt : lead.createdAt;
  return saoPauloMinutes(reference) >= splitMinutes(splitAt) ? "tarde" : "manha";
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
  splitAt?: string | null,
): DutyLeadShiftGroup<T>[] {
  const labels = shiftLabels(splitAt);
  const groups: DutyLeadShiftGroup<T>[] = (["manha", "tarde"] as const).map((key) => ({ key, label: labels[key], leads: [] }));
  for (const lead of leads) groups[getDutyLeadShift(lead, splitAt) === "manha" ? 0 : 1].leads.push(lead);
  return groups.filter((group) => group.leads.length > 0);
}

/** Leads each broker received in the occurrence, split by the same morning/afternoon cut as the list. */
export function countBrokerLeadsByShift<T extends { assignedAt: Date | null; corretorId: string | null; createdAt: Date }>(leads: T[], splitAt?: string | null) {
  const counts = new Map<string, Record<DutyLeadShift, number>>();
  for (const lead of leads) {
    if (!lead.corretorId) continue;
    const current = counts.get(lead.corretorId) ?? { manha: 0, tarde: 0 };
    current[getDutyLeadShift(lead, splitAt)] += 1;
    counts.set(lead.corretorId, current);
  }
  return counts;
}

/**
 * A lead a director/manager took "para investigação" (status under_analysis,
 * owned by management) is out of the plantão flow and must not be listed.
 * under_analysis owned by a broker is a normal funnel stage and stays.
 */
export function isManagementInvestigation(lead: { status: string; corretorId: string | null }, managementUserIds: ReadonlySet<string>) {
  return lead.status === "under_analysis" && Boolean(lead.corretorId) && managementUserIds.has(lead.corretorId!);
}
