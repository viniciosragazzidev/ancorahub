/**
 * Pure rules of the monthly duty plan (DEC-123): which occurrences a month has,
 * who may take each one and whether a draft is still publishable. No I/O, so
 * generation, manual edits and publication all validate the same way.
 */

export type MonthlyPlanSchedule = {
  id: string;
  name: string;
  branchId: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  minimumBrokers: number;
  maximumBrokers: number | null;
  timezone: string;
  validFrom: Date;
  validUntil: Date | null;
  /** Group of the plantão (PME, Premium...); null = no type. */
  typeId?: string | null;
  attendanceMode?: string | null;
  /** Units that take part in the plantão's type; empty/undefined = every unit. */
  typeBranchIds?: readonly string[] | null;
};

export type MonthlyPlanBroker = { id: string; branchId: string };

/** One plantão on one date. A global plantão is a single occurrence for the whole company. */
export type MonthlyPlanOccurrence = {
  id: string;
  scheduleId: string;
  scheduleName: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  minimumBrokers: number;
  maximumBrokers: number | null;
  allowedBrokerIds: string[];
  /** Absent on escalas generated before plantão types (DEC-138). */
  typeId?: string | null;
  attendanceMode?: "online" | "presencial";
  /** Brokers outside the type's units the Diretor confirmed anyway. */
  forcedBrokerIds?: string[];
};

export type MonthlyPlanAssignment = { occurrenceId: string; brokerId: string };

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function occurrenceId(scheduleId: string, dutyDate: string) {
  return `${scheduleId}:${dutyDate}`;
}

/** Calendar date of an instant in a time zone, as YYYY-MM-DD. */
export function localDateKey(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function offsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Midnight of `dateKey` in `timeZone` as an instant (DST-safe, no fixed offset). */
export function zonedMidnight(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}

/** Validity window of a published one-date row: [local midnight, next local midnight). */
export function occurrenceValidity(dutyDate: string, timeZone: string) {
  const [year, month, day] = dutyDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { validFrom: zonedMidnight(dutyDate, timeZone), validUntil: zonedMidnight(next, timeZone) };
}

export function dayOfWeekOf(dutyDate: string) {
  return new Date(`${dutyDate}T12:00:00Z`).getUTCDay();
}

/** Start of the shift on `dutyDate`, in the plantão's own time zone. */
function shiftStart(schedule: Pick<MonthlyPlanSchedule, "startsAt" | "timezone">, dutyDate: string) {
  const [hours, minutes] = schedule.startsAt.split(":").map(Number);
  return new Date(zonedMidnight(dutyDate, schedule.timezone).getTime() + (hours * 60 + minutes) * 60_000);
}

/** Same rule the runtime applies: the shift starts inside [validFrom, validUntil). */
export function isValidOn(schedule: Pick<MonthlyPlanSchedule, "startsAt" | "timezone" | "validFrom" | "validUntil">, dutyDate: string) {
  const start = shiftStart(schedule, dutyDate).getTime();
  return start >= schedule.validFrom.getTime() && (!schedule.validUntil || start < schedule.validUntil.getTime());
}

/** Whether a plantão has at least one shift in the month, and why not when it has none. */
export function monthCoverage(schedule: MonthlyPlanSchedule, monthKey: string): { covered: true } | { covered: false; reason: "ends_before" | "starts_after" | "no_weekday" | "empty_range" } {
  if (schedule.validUntil && schedule.validUntil.getTime() <= schedule.validFrom.getTime()) return { covered: false, reason: "empty_range" };
  // A short period without any day of its weekday never happens at all.
  if (schedule.validUntil && schedule.validUntil.getTime() - schedule.validFrom.getTime() < 8 * 24 * 3600_000) {
    let anyDate = false;
    for (let offset = -1; offset <= 8 && !anyDate; offset += 1) {
      const dutyDate = new Date(schedule.validFrom.getTime() + offset * 24 * 3600_000).toISOString().slice(0, 10);
      anyDate = dayOfWeekOf(dutyDate) === schedule.dayOfWeek && isValidOn(schedule, dutyDate);
    }
    if (!anyDate) return { covered: false, reason: "empty_range" };
  }
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let sawWeekday = false;
  for (let day = 1; day <= lastDay; day += 1) {
    const dutyDate = `${monthKey}-${String(day).padStart(2, "0")}`;
    if (dayOfWeekOf(dutyDate) !== schedule.dayOfWeek) continue;
    sawWeekday = true;
    if (isValidOn(schedule, dutyDate)) return { covered: true };
  }
  if (!sawWeekday) return { covered: false, reason: "no_weekday" };
  const firstDay = `${monthKey}-01`;
  return { covered: false, reason: shiftStart(schedule, firstDay).getTime() < schedule.validFrom.getTime() ? "starts_after" : "ends_before" };
}

/**
 * Whether every shift of the plantão in the month has already ended at `now`
 * ("encerrado" in the month view), and the date of its last shift there.
 */
export function monthShiftProgress(schedule: MonthlyPlanSchedule, monthKey: string, now: Date) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const [endHours, endMinutes] = schedule.endsAt.split(":").map(Number);
  let lastDate: string | null = null;
  let nextDate: string | null = null;
  const dates: Array<{ date: string; done: boolean }> = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const dutyDate = `${monthKey}-${String(day).padStart(2, "0")}`;
    if (dayOfWeekOf(dutyDate) !== schedule.dayOfWeek || !isValidOn(schedule, dutyDate)) continue;
    const end = zonedMidnight(dutyDate, schedule.timezone).getTime() + (endHours * 60 + endMinutes) * 60_000;
    const done = end <= now.getTime();
    dates.push({ date: dutyDate, done });
    if (done) lastDate = dutyDate;
    else if (!nextDate) nextDate = dutyDate;
  }
  return { finished: lastDate !== null && nextDate === null, lastDate, nextDate, dates };
}

/** Monthly counters use calendar days, not the number of schedule rules on a day. */
export function summarizeDutyDays(progresses: Iterable<{ dates: readonly { date: string; done: boolean }[] } | undefined>) {
  const upcomingByDate = new Map<string, boolean>();
  for (const progress of progresses) {
    for (const { date, done } of progress?.dates ?? []) {
      upcomingByDate.set(date, (upcomingByDate.get(date) ?? false) || !done);
    }
  }
  const upcoming = [...upcomingByDate.values()].filter(Boolean).length;
  return { total: upcomingByDate.size, upcoming, finished: upcomingByDate.size - upcoming };
}

/**
 * A plantão that happens on a single date (the default kind): its validity
 * holds at most one shift. Weekly rules (no end, or 2+ dates) return false.
 */
export function isSingleOccurrencePlantao(schedule: Pick<MonthlyPlanSchedule, "dayOfWeek" | "startsAt" | "timezone" | "validFrom" | "validUntil">) {
  if (!schedule.validUntil) return false;
  if (schedule.validUntil.getTime() - schedule.validFrom.getTime() >= 8 * 24 * 3600_000) return false;
  let dates = 0;
  for (let offset = -1; offset <= 8; offset += 1) {
    const dutyDate = new Date(schedule.validFrom.getTime() + offset * 24 * 3600_000).toISOString().slice(0, 10);
    if (dayOfWeekOf(dutyDate) === schedule.dayOfWeek && isValidOn(schedule, dutyDate)) dates += 1;
  }
  return dates <= 1;
}

/** First shift of the plantão inside its validity (looks up to two weeks ahead). */
export function firstValidShift(schedule: Pick<MonthlyPlanSchedule, "dayOfWeek" | "startsAt" | "endsAt" | "timezone" | "validFrom" | "validUntil">) {
  const startKey = localDateKey(schedule.validFrom, schedule.timezone);
  const [year, month, day] = startKey.split("-").map(Number);
  for (let offset = 0; offset < 14; offset += 1) {
    const dutyDate = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    if (dayOfWeekOf(dutyDate) !== schedule.dayOfWeek || !isValidOn(schedule, dutyDate)) continue;
    const start = shiftStart(schedule, dutyDate);
    const [hours, minutes] = schedule.endsAt.split(":").map(Number);
    const end = new Date(zonedMidnight(dutyDate, schedule.timezone).getTime() + (hours * 60 + minutes) * 60_000);
    return { dutyDate, start, end };
  }
  return null;
}

/** When the shift on `dutyDate` ends; a shift ending at or before its start runs past midnight. */
export function shiftEnd(schedule: Pick<MonthlyPlanSchedule, "startsAt" | "endsAt" | "timezone">, dutyDate: string) {
  const start = shiftStart(schedule, dutyDate);
  const [hours, minutes] = schedule.endsAt.split(":").map(Number);
  const end = new Date(zonedMidnight(dutyDate, schedule.timezone).getTime() + (hours * 60 + minutes) * 60_000);
  return end.getTime() <= start.getTime() ? new Date(end.getTime() + 24 * 3600_000) : end;
}

/**
 * Every occurrence of the month: one per active plantão per matching date.
 * With `from`, shifts that already ended at that instant are left out: a
 * plantão that is over can never be staffed (one running now still counts).
 */
export function buildMonthOccurrences(monthKey: string, schedules: readonly MonthlyPlanSchedule[], brokers: readonly MonthlyPlanBroker[], options: { from?: Date } = {}) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return buildRangeOccurrences(`${monthKey}-01`, lastDay, schedules, brokers, options);
}

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** An escala may run past the end of its month (plantões that end days later), up to this many days. */
export const MAX_PLAN_RANGE_DAYS = 62;

export function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, until: string) {
  return Math.round((Date.parse(`${until}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Whether a broker's unit takes part in the plantão (its own unit, then its type's units). */
export function unitAllowed(schedule: Pick<MonthlyPlanSchedule, "branchId" | "typeBranchIds">, branchId: string | null) {
  if (schedule.branchId) return branchId === schedule.branchId;
  return !schedule.typeBranchIds?.length || (branchId !== null && schedule.typeBranchIds.includes(branchId));
}

/**
 * Every occurrence in [from, until] (both included): one per plantão per
 * matching date. With `from` in options, shifts that already ended at that
 * instant are left out: a plantão that is over can never be staffed (one
 * running now still counts).
 */
export function buildRangeOccurrences(fromKey: string, untilKey: string, schedules: readonly MonthlyPlanSchedule[], brokers: readonly MonthlyPlanBroker[], options: { from?: Date } = {}) {
  const occurrences: MonthlyPlanOccurrence[] = [];
  if (!DATE_KEY_PATTERN.test(fromKey) || !DATE_KEY_PATTERN.test(untilKey) || untilKey < fromKey) return occurrences;
  for (let dutyDate = fromKey; dutyDate <= untilKey; dutyDate = addDays(dutyDate, 1)) {
    const weekday = dayOfWeekOf(dutyDate);
    for (const schedule of schedules) {
      if (schedule.dayOfWeek !== weekday || !isValidOn(schedule, dutyDate)) continue;
      if (options.from && shiftEnd(schedule, dutyDate).getTime() <= options.from.getTime()) continue;
      occurrences.push({
        id: occurrenceId(schedule.id, dutyDate),
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        dutyDate,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        minimumBrokers: schedule.minimumBrokers,
        maximumBrokers: schedule.maximumBrokers,
        // Unit plantão: that unit's brokers; global: the units of its type (all when none).
        allowedBrokerIds: brokers.filter((broker) => unitAllowed(schedule, broker.branchId)).map((broker) => broker.id),
        typeId: schedule.typeId ?? null,
        attendanceMode: schedule.attendanceMode === "presencial" ? "presencial" : "online",
      });
    }
  }
  return occurrences.sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Key used for plantões without a type in the planner's settings. */
export const NO_TYPE_KEY = "__none";
export const typeKeyOf = (typeId: string | null | undefined) => typeId ?? NO_TYPE_KEY;

export type PlanBrokerModality = "any" | "online" | "presencial";

/** One qualified broker of an escala: modality, the types they take and their seats per type. */
export type PlanBrokerSetting = {
  brokerId: string;
  modality: PlanBrokerModality;
  /** Seats (plantões) per type key; a type the broker does not take is absent or 0. */
  seats: Record<string, number>;
  /** Type keys the Diretor confirmed although the broker's unit is outside the type. */
  forcedTypeKeys: string[];
};

export type PlanSettings = {
  rangeFrom: string;
  rangeUntil: string;
  typeKeys: string[];
  brokers: PlanBrokerSetting[];
};

export function parsePlanSettings(value: unknown): PlanSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PlanSettings>;
  if (typeof raw.rangeFrom !== "string" || typeof raw.rangeUntil !== "string" || !Array.isArray(raw.typeKeys)) return null;
  return {
    rangeFrom: raw.rangeFrom,
    rangeUntil: raw.rangeUntil,
    typeKeys: raw.typeKeys.filter((key): key is string => typeof key === "string"),
    brokers: (Array.isArray(raw.brokers) ? raw.brokers : []).filter((item): item is PlanBrokerSetting => Boolean(item && typeof item.brokerId === "string")).map((item) => ({
      brokerId: item.brokerId,
      modality: item.modality === "online" || item.modality === "presencial" ? item.modality : "any",
      seats: Object.fromEntries(Object.entries(item.seats ?? {}).filter(([, seats]) => Number.isFinite(seats) && seats > 0).map(([key, seats]) => [key, Math.trunc(seats)])),
      forcedTypeKeys: Array.isArray(item.forcedTypeKeys) ? item.forcedTypeKeys.filter((key) => typeof key === "string") : [],
    })),
  };
}

/** Whether a broker with this modality may take an occurrence of this attendance mode. */
export function modalityAllows(modality: PlanBrokerModality, attendanceMode: string | null | undefined) {
  return modality === "any" || modality === (attendanceMode === "presencial" ? "presencial" : "online");
}

function overlaps(a: Pick<MonthlyPlanOccurrence, "dutyDate" | "startsAt" | "endsAt">, b: Pick<MonthlyPlanOccurrence, "dutyDate" | "startsAt" | "endsAt">) {
  return a.dutyDate === b.dutyDate && a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export type DraftProblem =
  | { kind: "unknown_occurrence"; occurrenceId: string }
  | { kind: "not_eligible"; occurrenceId: string; brokerId: string }
  | { kind: "duplicate"; occurrenceId: string; brokerId: string }
  | { kind: "over_capacity"; occurrenceId: string }
  | { kind: "overlap"; occurrenceId: string; brokerId: string };

/** Everything that would make a draft unsafe to publish. Empty means publishable. */
export function findDraftProblems(occurrences: readonly MonthlyPlanOccurrence[], assignments: readonly MonthlyPlanAssignment[]): DraftProblem[] {
  // DEC-132: an overlap is a warning, not a blocker — see findDraftOverlaps.
  return findDraftIssues(occurrences, assignments, false);
}

/** Same-broker simultaneous occurrences: allowed (DEC-132) but shown as a warning. */
export function findDraftOverlaps(occurrences: readonly MonthlyPlanOccurrence[], assignments: readonly MonthlyPlanAssignment[]): DraftProblem[] {
  return findDraftIssues(occurrences, assignments, true);
}

function findDraftIssues(occurrences: readonly MonthlyPlanOccurrence[], assignments: readonly MonthlyPlanAssignment[], onlyOverlaps: boolean): DraftProblem[] {
  const byId = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  const problems: DraftProblem[] = [];
  const seen = new Set<string>();
  const perOccurrence = new Map<string, number>();
  const perBroker = new Map<string, MonthlyPlanOccurrence[]>();
  for (const assignment of assignments) {
    const occurrence = byId.get(assignment.occurrenceId);
    if (!occurrence) {
      if (!onlyOverlaps) problems.push({ kind: "unknown_occurrence", occurrenceId: assignment.occurrenceId });
      continue;
    }
    const key = `${assignment.occurrenceId}|${assignment.brokerId}`;
    if (seen.has(key)) {
      if (!onlyOverlaps) problems.push({ kind: "duplicate", occurrenceId: occurrence.id, brokerId: assignment.brokerId });
      continue;
    }
    seen.add(key);
    if (!onlyOverlaps && !occurrence.allowedBrokerIds.includes(assignment.brokerId)) problems.push({ kind: "not_eligible", occurrenceId: occurrence.id, brokerId: assignment.brokerId });
    const others = perBroker.get(assignment.brokerId) ?? [];
    // Overlap is only collected by findDraftOverlaps (warning); it never blocks.
    if (onlyOverlaps && others.some((other) => overlaps(other, occurrence))) problems.push({ kind: "overlap", occurrenceId: occurrence.id, brokerId: assignment.brokerId });
    perBroker.set(assignment.brokerId, [...others, occurrence]);
    perOccurrence.set(occurrence.id, (perOccurrence.get(occurrence.id) ?? 0) + 1);
  }
  if (!onlyOverlaps) {
    for (const [id, count] of perOccurrence) {
      const occurrence = byId.get(id)!;
      if (occurrence.maximumBrokers !== null && count > occurrence.maximumBrokers) problems.push({ kind: "over_capacity", occurrenceId: id });
    }
  }
  return problems;
}

export function describeDraftProblem(problem: DraftProblem) {
  switch (problem.kind) {
    case "unknown_occurrence": return "A proposta tem um plantão que não existe mais neste período.";
    case "not_eligible": return "Um corretor da proposta não pode atuar neste plantão.";
    case "duplicate": return "Um corretor aparece duas vezes no mesmo plantão.";
    case "over_capacity": return "Um plantão passou do máximo de corretores.";
    case "overlap": return "Um corretor ficou em dois plantões no mesmo horário; ele atenderá nos dois.";
  }
}

/** Per-occurrence and per-broker summary shown in the review. */
export function summarizeDraft(occurrences: readonly MonthlyPlanOccurrence[], assignments: readonly MonthlyPlanAssignment[], quotas: ReadonlyMap<string, number>) {
  const assigned = new Map<string, number>();
  const byBroker = new Map<string, number>();
  for (const assignment of assignments) {
    assigned.set(assignment.occurrenceId, (assigned.get(assignment.occurrenceId) ?? 0) + 1);
    byBroker.set(assignment.brokerId, (byBroker.get(assignment.brokerId) ?? 0) + 1);
  }
  const belowMinimum = occurrences.filter((occurrence) => (assigned.get(occurrence.id) ?? 0) < occurrence.minimumBrokers).length;
  const missingQuota = [...quotas].reduce((sum, [brokerId, quota]) => sum + Math.max(0, quota - (byBroker.get(brokerId) ?? 0)), 0);
  return { assignedByOccurrence: assigned, assignedByBroker: byBroker, belowMinimum, missingQuota };
}
