export type ColdLeadReactivationCandidate = {
  qualificationStatus: string | null;
  qualificationState: string | null;
  qualificationCompletedAt: Date | null;
  corretorId: string | null;
  status: string;
  distributionStatus: string | null;
  distributionRemovedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
};

const TIME_ZONE = "America/Sao_Paulo";
const FOLLOW_UP_DELAY_MS = 2 * 60 * 60 * 1000;
const WEEKDAY_NUMBER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function getColdLeadReactivationRuleDefaults() {
  return {
    name: "Reativação de lead frio",
    trigger: "cold_lead_reactivation" as const,
    enabled: true,
    delayMinutes: 120,
    maxAttempts: 1,
    minimumIntervalMinutes: 120,
    allowedDays: [1, 2, 3, 4, 5],
    allowedStartTime: "08:00",
    allowedEndTime: "18:00",
    timezone: TIME_ZONE,
    messageMode: "template" as const,
    fixedMessage: undefined,
    templateId: undefined,
    stopConditions: ["client_responded", "human_taken", "lead_closed", "sale_completed", "opt_out"],
  };
}

export function getColdLeadInboundAction(input: {
  qualificationStatus: string | null;
  corretorRole: string | null;
  featureEnabled: boolean;
  optedOut: boolean;
}): "resume_qualification" | "acknowledge_broker" | "ignore" {
  if (input.qualificationStatus !== "cold" || !input.featureEnabled || input.optedOut) return "ignore";
  if (input.corretorRole === "broker") return "acknowledge_broker";
  if (input.corretorRole === null) return "resume_qualification";
  return "ignore";
}

export function isEligibleColdLeadForReactivation(lead: ColdLeadReactivationCandidate) {
  return lead.qualificationStatus === "cold"
    && (lead.qualificationState === "QUALIFIED" || lead.qualificationState === "COMPLETED")
    && Boolean(lead.qualificationCompletedAt)
    && !lead.corretorId
    && !["lost", "converted", "under_analysis", "deleted", "archived"].includes(lead.status)
    && !["disqualified", "not_qualified"].includes(lead.qualificationStatus ?? "")
    && !["assigned", "manual_hold", "held", "removed", "returned_to_queue"].includes(lead.distributionStatus ?? "")
    && !lead.distributionRemovedAt
    && !lead.archivedAt
    && !lead.deletedAt;
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAY_NUMBER[get("weekday")] ?? 7,
  };
}

function localDateTimeToUtc(parts: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute">) {
  const wanted = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let guess = wanted;
  // Resolve the timezone offset from Intl instead of assuming a fixed UTC-3.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(guess));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const correction = wanted - represented;
    if (!correction) break;
    guess += correction;
  }
  return new Date(guess);
}

function nextLocalDate(parts: ZonedParts): Pick<ZonedParts, "year" | "month" | "day"> {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/** Earliest permitted time at or after both qualification completion + 2h and `now`. */
export function getColdLeadReactivationAt(qualificationCompletedAt: Date, now: Date) {
  const earliest = new Date(Math.max(qualificationCompletedAt.getTime() + FOLLOW_UP_DELAY_MS, now.getTime()));
  let local = zonedParts(earliest);

  for (let day = 0; day < 8; day += 1) {
    if (local.weekday >= 1 && local.weekday <= 5) {
      const beforeOpen = local.hour < 8;
      const withinWindow = local.hour >= 8 && local.hour < 18;
      if (beforeOpen) return localDateTimeToUtc({ ...local, hour: 8, minute: 0 });
      if (withinWindow) return earliest;
    }
    const next = nextLocalDate(local);
    const nextUtc = localDateTimeToUtc({ ...next, hour: 8, minute: 0 });
    local = zonedParts(nextUtc);
    if (local.weekday >= 1 && local.weekday <= 5) return nextUtc;
  }

  throw new Error("Não foi possível calcular a próxima janela de reativação.");
}
