import {
  defaultColdLeadRequalificationPolicy,
  type ColdLeadRequalificationPolicy,
} from "@/features/lead-distribution/domain";

const TIME_ZONE = "America/Sao_Paulo";
export const COLD_LEAD_REQUALIFICATION_OUTBOUND_PREFIX = "cold-lead-requalification:";

/**
 * Automatic requalification (Vinicios, 20/10): one try, 3 hours after the lead turned cold,
 * in every automatic queue (the per-queue switch no longer gates it). A manual send from the
 * panel counts as that one try.
 */
export const AUTOMATIC_COLD_LEAD_REQUALIFICATION: ColdLeadRequalificationPolicy = { enabled: true, intervalMinutes: 180, maxAttempts: 1 };
/** Leads that turned cold longer ago than this stay with the panel: the first run must not message the old backlog. */
export const AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS = 24;

/** When the lead turned cold: the qualification end, else the timeout hold (no valid data), else its arrival. */
export function coldSinceAt(lead: { qualificationCompletedAt: Date | null; createdAt: Date }, timeoutHoldAt: Date | null | undefined) {
  return lead.qualificationCompletedAt ?? timeoutHoldAt ?? lead.createdAt;
}

/** Due 3 hours after turning cold, only once, and only for leads that turned cold in the last 24 hours. */
export function automaticRequalificationDue(input: { coldSince: Date; attempts: number; now: Date }) {
  const policy = AUTOMATIC_COLD_LEAD_REQUALIFICATION;
  const ageMs = input.now.getTime() - input.coldSince.getTime();
  return input.attempts < policy.maxAttempts
    && ageMs >= policy.intervalMinutes * 60_000
    && ageMs <= AUTOMATIC_REQUALIFICATION_LOOKBACK_HOURS * 60 * 60_000;
}

export type ColdLeadRequalificationInput = {
  id: string;
  createdAt: Date;
  qualificationStatus: string | null;
  qualificationState?: string | null;
  qualificationCompletedAt?: Date | null;
  corretorId: string | null;
  status: string;
  distributionStatus: string | null;
  distributionRemovedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  queueId: string | null;
};

export async function runWithRequalificationLock<T>(acquire: () => Promise<boolean>, task: () => Promise<T>) {
  if (!await acquire()) return { acquired: false as const };
  return { acquired: true as const, value: await task() };
}

export function selectColdLeadsForOperationDay<T extends ColdLeadRequalificationInput>(
  leads: readonly T[],
  since: Date,
) {
  return leads.filter((lead) => lead.createdAt >= since && isEligibleColdLeadForManualRequalification(lead));
}

/** Manual review may include an incomplete cold timeout explicitly held for requalification. */
export function isEligibleColdLeadForManualRequalification(lead: ColdLeadRequalificationInput) {
  const isColdTimeoutHold = lead.distributionStatus === "manual_hold"
    && lead.qualificationState === "PARTIAL"
    && !lead.qualificationCompletedAt;
  return lead.qualificationStatus === "cold"
    && !lead.corretorId
    && lead.queueId !== null
    && !["lost", "converted", "under_analysis", "deleted", "archived"].includes(lead.status)
    && !["assigned", "held", "removed", "returned_to_queue"].includes(lead.distributionStatus ?? "")
    && (lead.distributionStatus !== "manual_hold" || isColdTimeoutHold)
    && !lead.distributionRemovedAt
    && !lead.archivedAt
    && !lead.deletedAt;
}

export function partitionColdLeadsByResponse<T extends { id: string; createdAt: Date }>(
  leads: readonly T[],
  inboundByLead: ReadonlyMap<string, Date>,
) {
  const noResponse: T[] = [];
  const respondedStillCold: T[] = [];
  for (const lead of leads) {
    const inboundAt = inboundByLead.get(lead.id);
    if (inboundAt && inboundAt.getTime() >= lead.createdAt.getTime() + 5_000) respondedStillCold.push(lead);
    else noResponse.push(lead);
  }
  return { noResponse, respondedStillCold };
}

export function countRequalificationAttempts(rows: readonly { status: string }[]) {
  return rows.filter((row) => !["cancelled", "expired", "skipped"].includes(row.status)).length;
}

export function isRequalificationInCooldown(lastAttemptAt: Date | null, now: Date, intervalMinutes: number) {
  return Boolean(lastAttemptAt && now.getTime() - lastAttemptAt.getTime() < intervalMinutes * 60_000);
}

export function requalificationSendDecision(input: {
  policy: ColdLeadRequalificationPolicy;
  attempts: number;
  maxAttempts?: number;
  hasInboundSinceLastPrompt: boolean;
  optedOut: boolean;
  wrongNumber: boolean;
  eligible: boolean;
  lastAttemptAt: Date | null;
  now: Date;
}): { allowed: true } | { allowed: false; reason: string } {
  if (!input.eligible) return { allowed: false, reason: "O lead saiu da fila ou nao esta mais elegivel." };
  if (input.optedOut) return { allowed: false, reason: "O lead pediu para parar." };
  if (input.wrongNumber) return { allowed: false, reason: "O numero foi marcado como invalido." };
  if (isRequalificationInCooldown(input.lastAttemptAt, input.now, input.policy.intervalMinutes)) {
    return { allowed: false, reason: "Aguarde o intervalo minimo antes de reenviar." };
  }
  if (!input.policy.enabled) return { allowed: false, reason: "A requalificacao automatica esta desligada nesta fila." };
  if (input.hasInboundSinceLastPrompt) return { allowed: false, reason: "O lead respondeu depois do ultimo convite." };
  const maxAttempts = input.maxAttempts ?? input.policy.maxAttempts;
  if (input.attempts >= maxAttempts) return { allowed: false, reason: "O limite de tentativas desta fila foi atingido." };
  return { allowed: true };
}

function saoPauloParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function localTimeToUtc(parts: ReturnType<typeof saoPauloParts>) {
  const wanted = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let guess = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = saoPauloParts(new Date(guess));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const correction = wanted - represented;
    if (!correction) break;
    guess += correction;
  }
  return new Date(guess);
}

export function nextRequalificationBusinessWindowAt(date: Date) {
  const local = saoPauloParts(date);
  const minuteOfDay = local.hour * 60 + local.minute;
  if (minuteOfDay >= 8 * 60 && minuteOfDay < 20 * 60) return date;
  if (minuteOfDay < 8 * 60) return localTimeToUtc({ ...local, hour: 8, minute: 0 });
  const tomorrow = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return localTimeToUtc({ ...local, year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate(), hour: 8, minute: 0 });
}

export function isWithinRequalificationBusinessWindow(date: Date) {
  const local = saoPauloParts(date);
  const minuteOfDay = local.hour * 60 + local.minute;
  return minuteOfDay >= 8 * 60 && minuteOfDay < 20 * 60;
}

export function normalizeColdLeadRequalificationPolicy(value: unknown): ColdLeadRequalificationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultColdLeadRequalificationPolicy;
  const raw = value as Partial<ColdLeadRequalificationPolicy>;
  return {
    enabled: raw.enabled === true,
    intervalMinutes: Number.isInteger(raw.intervalMinutes) ? Math.max(15, Math.min(1440, raw.intervalMinutes!)) : 120,
    maxAttempts: Number.isInteger(raw.maxAttempts) ? Math.max(1, Math.min(10, raw.maxAttempts!)) : 3,
  };
}
