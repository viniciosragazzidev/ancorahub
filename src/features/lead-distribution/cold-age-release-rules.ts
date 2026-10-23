/**
 * Leads Frios (Vinicios, 23/10): the cold queue only hands a lead to a broker once it is
 * 2 days old, released every day at 9h (São Paulo). On 23/10 at 9h the leads of 21/10 and
 * before go out; until then the automatic requalification still has its chance.
 * Pure: the clock and the dates come from the caller.
 */
export const COLD_RELEASE_MIN_DAYS = 2;
export const COLD_RELEASE_HOUR = 9;
const DAY = 24 * 60 * 60_000;

/** São Paulo has no daylight saving time since 2019. */
function spDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function spStartOfDay(date: Date) {
  return new Date(`${spDayKey(date)}T00:00:00-03:00`);
}

function spHour(date: Date) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function todayKeyInSaoPaulo(now: Date) {
  return spDayKey(now);
}

/**
 * Leads created before this instant may go out now. Before 9h it is still yesterday's
 * release; "Liberar agora" (releasedEarlyToday) anticipates today's.
 */
export function coldReleaseCutoff(now: Date, releasedEarlyToday = false) {
  const today = spStartOfDay(now).getTime();
  const base = releasedEarlyToday || spHour(now) >= COLD_RELEASE_HOUR ? today : today - DAY;
  return new Date(base - (COLD_RELEASE_MIN_DAYS - 1) * DAY);
}

/** When a lead created at `createdAt` is released: 9h of the day it turns 2 days old. */
export function coldReleaseAt(createdAt: Date) {
  const createdDay = spStartOfDay(createdAt).getTime();
  return new Date(createdDay + COLD_RELEASE_MIN_DAYS * DAY + COLD_RELEASE_HOUR * 60 * 60_000);
}

export function isColdReleased(createdAt: Date, now: Date, releasedEarlyToday = false) {
  return createdAt.getTime() < coldReleaseCutoff(now, releasedEarlyToday).getTime();
}

/** The queue this rule is on by default: the one named "Leads Frios" (any case, accents). */
export function isColdLeadsQueueName(name: string | null | undefined) {
  return /\bfrios?\b/i.test((name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, ""));
}
