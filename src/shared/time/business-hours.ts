export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;

type LocalBusinessTime = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

const localTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const weekdayByName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localBusinessTime(date: Date): LocalBusinessTime {
  const parts = new Map(localTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = weekdayByName[parts.get("weekday") ?? ""];
  if (weekday === undefined) throw new Error("Não foi possível resolver o dia útil local.");
  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    weekday,
    hour: Number(parts.get("hour")),
    minute: Number(parts.get("minute")),
  };
}

function timezoneOffsetAt(instant: Date) {
  const local = localBusinessTime(instant);
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - instant.getTime();
}

function zonedBusinessOpeningToUtc(year: number, month: number, day: number) {
  const approximate = new Date(Date.UTC(year, month - 1, day, BUSINESS_START_HOUR, 0, 0));
  return new Date(approximate.getTime() - timezoneOffsetAt(approximate));
}

function nextWeekday(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  do candidate.setUTCDate(candidate.getUTCDate() + 1);
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6);
  return { year: candidate.getUTCFullYear(), month: candidate.getUTCMonth() + 1, day: candidate.getUTCDate() };
}

export function isWithinBusinessHours(now = new Date()) {
  const local = localBusinessTime(now);
  return local.weekday >= 1 && local.weekday <= 5
    && local.hour >= BUSINESS_START_HOUR
    && local.hour < BUSINESS_END_HOUR;
}

/** Returns the current instant when open, otherwise the next weekday at 08:00 BRT. */
export function scheduleForBusinessHours(now = new Date()) {
  if (isWithinBusinessHours(now)) return now;
  const local = localBusinessTime(now);
  const sameWeekdayBeforeOpening = local.weekday >= 1 && local.weekday <= 5 && local.hour < BUSINESS_START_HOUR;
  const next = sameWeekdayBeforeOpening
    ? { year: local.year, month: local.month, day: local.day }
    : nextWeekday(local.year, local.month, local.day);
  return zonedBusinessOpeningToUtc(next.year, next.month, next.day);
}

