export type DutyWindow = {
  dutyDate: string;
  startsAt: Date;
  endsAt: Date;
};

export type ConfirmedDutyOccurrence = {
  scheduleId: string;
  brokerId: string;
  dutyDate: string;
  shiftStartsAt: Date;
  shiftEndsAt: Date;
  status: string;
};

type WeeklyWindowInput = {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[values.weekday as "Sun"];
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: weekday ?? 0,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(key: string, amount: number) {
  const [year, month, day] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function localTimeToUtc(day: string, clock: string, timezone: string) {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  const targetMinutes = Date.UTC(year, month - 1, date, hour, minute) / 60_000;
  let candidate = new Date(targetMinutes * 60_000);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(candidate, timezone);
    const actualMinutes = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute) / 60_000;
    const difference = targetMinutes - actualMinutes;
    if (difference === 0) break;
    candidate = new Date(candidate.getTime() + difference * 60_000);
  }
  return candidate;
}

/** Returns this week's matching shift if it is within its 30-minute reminder window or active. */
export function getRelevantDutyWindow(input: WeeklyWindowInput, now: Date, leadMinutes = 30): DutyWindow | null {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) return null;
  const localNow = zonedParts(now, input.timezone);
  const today = dateKey(localNow.year, localNow.month, localNow.day);
  for (const offset of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
    const dutyDate = addCalendarDays(today, offset);
    const [year, month, day] = dutyDate.split("-").map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== input.dayOfWeek) continue;
    const startsAt = localTimeToUtc(dutyDate, input.startsAt, input.timezone);
    let endsAt = localTimeToUtc(dutyDate, input.endsAt, input.timezone);
    if (endsAt <= startsAt) endsAt = localTimeToUtc(addCalendarDays(dutyDate, 1), input.endsAt, input.timezone);
    const reminderStartsAt = startsAt.getTime() - leadMinutes * 60_000;
    if (now.getTime() >= reminderStartsAt && now < endsAt) return { dutyDate, startsAt, endsAt };
  }
  return null;
}

/** The most recent occurrence of this schedule whose end is at or before `referenceTime`, searching back up to a week. */
function findMostRecentCompletedOccurrence(input: WeeklyWindowInput, referenceTime: Date): DutyWindow | null {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) return null;
  const localRef = zonedParts(referenceTime, input.timezone);
  const refDay = dateKey(localRef.year, localRef.month, localRef.day);
  // 0 through -6 is 7 consecutive days, so exactly one of them is the
  // schedule's weekday — except when that's today and today's occurrence
  // hasn't ended by `referenceTime` yet, in which case the one before it is
  // a full week back at offset -7.
  for (const offset of [0, -1, -2, -3, -4, -5, -6, -7]) {
    const dutyDate = addCalendarDays(refDay, offset);
    const [year, month, day] = dutyDate.split("-").map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== input.dayOfWeek) continue;
    const startsAt = localTimeToUtc(dutyDate, input.startsAt, input.timezone);
    let endsAt = localTimeToUtc(dutyDate, input.endsAt, input.timezone);
    if (endsAt <= startsAt) endsAt = localTimeToUtc(addCalendarDays(dutyDate, 1), input.endsAt, input.timezone);
    if (endsAt <= referenceTime) return { dutyDate, startsAt, endsAt };
  }
  return null;
}

/** The most recently completed occurrence across a family of schedules (e.g. every weekday of the same rotating plantão), whichever of them ended latest at or before `referenceTime`. */
function mostRecentCompletedAcrossFamily(schedules: WeeklyWindowInput[], referenceTime: Date): DutyWindow | null {
  let best: DutyWindow | null = null;
  for (const schedule of schedules) {
    const occurrence = findMostRecentCompletedOccurrence(schedule, referenceTime);
    if (occurrence && (!best || occurrence.endsAt > best.endsAt)) best = occurrence;
  }
  return best;
}

/**
 * The exact window of leads that belong to "this plantão" right now: the
 * occurrence currently in progress (open-ended — still collecting, so
 * `until` is null) if we're inside one, otherwise the most recently
 * completed occurrence, bounded on the end so a closed shift's page doesn't
 * keep absorbing leads that arrived after it ended.
 *
 * The lower bound reaches into `family` — every schedule sharing the same
 * queue(s) as `schedule`, itself included — because a plantão is commonly
 * one row per weekday (Mon..Fri as five separate schedules): "the previous
 * occurrence" a lead should be counted from is usually a *different*
 * weekday's schedule (yesterday's), not this same schedule a week back.
 * Pass `[schedule]` when there is no rotation to widen into.
 *
 * Falls back to "show everything" (epoch, no upper bound) if the schedule
 * never had a completed occurrence yet — brand new today, for example.
 */
export function getDutyOccurrenceLeadWindow(schedule: WeeklyWindowInput, family: WeeklyWindowInput[], now: Date): { since: Date; until: Date | null } {
  const current = getRelevantDutyWindow(schedule, now, 0);
  const active = isDutyWindowActive(current, now);
  const relevant = active ? current! : findMostRecentCompletedOccurrence(schedule, now);
  if (!relevant) return { since: new Date(0), until: null };

  const until = active ? null : relevant.endsAt;
  const previous = mostRecentCompletedAcrossFamily(family, relevant.startsAt);
  const since = previous ? previous.endsAt : relevant.startsAt;
  return { since, until };
}

export function isDutyWindowActive(window: DutyWindow | null, now: Date) {
  return Boolean(window && window.startsAt <= now && window.endsAt > now);
}

export function isConfirmationForActiveOccurrence(input: {
  confirmation: ConfirmedDutyOccurrence | null | undefined;
  assignment: { scheduleId: string; brokerId: string };
  window: DutyWindow;
  now: Date;
}) {
  const { confirmation, assignment, window, now } = input;
  return Boolean(confirmation
    && confirmation.status === "confirmed"
    && confirmation.scheduleId === assignment.scheduleId
    && confirmation.brokerId === assignment.brokerId
    && confirmation.dutyDate === window.dutyDate
    && confirmation.shiftStartsAt.getTime() === window.startsAt.getTime()
    && confirmation.shiftEndsAt.getTime() === window.endsAt.getTime()
    && isDutyWindowActive(window, now));
}

export function formatDutyStartHour(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
