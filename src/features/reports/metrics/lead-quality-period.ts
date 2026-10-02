import { PERIOD_OPTIONS, DEFAULT_PERIOD, periodStart, type PeriodValue } from "@/shared/period";

/**
 * Period of the lead quality center: the shared 7/14/30/90 days, or "today" —
 * the operation's day, from 18:00 of the day before to 18:00 of today
 * (a lead at 19:00 already belongs to tomorrow's "today").
 */
export type LeadQualityPeriod = PeriodValue | "today";

export const LEAD_QUALITY_TIMEZONE = "America/Sao_Paulo";
/** The operation's day turns at 18:00; the first shift runs until 13:30. */
export const OPERATION_DAY_STARTS_AT = "18:00";
export const SHIFT_SPLIT_AT = "13:30";

export const LEAD_SHIFTS = [
  { key: 1, label: "Turno 1", hours: "18h – 13h30" },
  { key: 2, label: "Turno 2", hours: "13h30 – 18h" },
] as const;
export type LeadShift = (typeof LEAD_SHIFTS)[number]["key"];

export function parseLeadQualityPeriod(raw: unknown): LeadQualityPeriod {
  if (raw === "today" || raw === "hoje") return "today";
  if (typeof raw !== "string") return DEFAULT_PERIOD;
  const days = Number.parseInt(raw, 10);
  return (PERIOD_OPTIONS as readonly number[]).includes(days) ? (days as PeriodValue) : DEFAULT_PERIOD;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

/** UTC instant of a wall-clock time ("HH:MM") on a calendar day in `timeZone`. */
function wallClockToUtc(year: number, month: number, day: number, clock: string, timeZone: string) {
  const [hour, minute] = clock.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const seen = zonedParts(new Date(guess), timeZone);
  const offset = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess;
  return new Date(guess - offset);
}

/** Leads created in [since, until). `until` null = still open. */
export type LeadQualityWindow = { since: Date; until: Date | null };

export function leadQualityWindow(period: LeadQualityPeriod, now = new Date()): LeadQualityWindow {
  if (period !== "today") return { since: periodStart(period, now), until: null };
  const today = zonedParts(now, LEAD_QUALITY_TIMEZONE);
  const until = wallClockToUtc(today.year, today.month, today.day, OPERATION_DAY_STARTS_AT, LEAD_QUALITY_TIMEZONE);
  return { since: new Date(until.getTime() - 24 * 60 * 60 * 1000), until };
}

/** Shift of a lead: 13:30–18:00 is the second; 18:00–13:30 (across midnight) the first. */
export function leadShiftOf(createdAt: Date): LeadShift {
  const local = zonedParts(createdAt, LEAD_QUALITY_TIMEZONE);
  const minutes = local.hour * 60 + local.minute;
  const [splitHour, splitMinute] = SHIFT_SPLIT_AT.split(":").map(Number);
  const [dayHour, dayMinute] = OPERATION_DAY_STARTS_AT.split(":").map(Number);
  return minutes >= splitHour * 60 + splitMinute && minutes < dayHour * 60 + dayMinute ? 2 : 1;
}

export function leadQualityPeriodLabel(period: LeadQualityPeriod) {
  return period === "today" ? "Hoje (18h de ontem às 18h)" : `Últimos ${period} dias`;
}

const windowFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: LEAD_QUALITY_TIMEZONE });

export function leadQualityWindowLabel(window: LeadQualityWindow, now = new Date()) {
  return `${windowFormat.format(window.since)} – ${windowFormat.format(window.until ?? now)}`;
}
