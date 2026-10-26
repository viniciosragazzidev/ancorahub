/**
 * When a broker can answer, in São Paulo time. Brokers answer Monday to Saturday from 9h to 19h,
 * except national holidays (Vinicios, 26/10): on Sunday and holidays the customer hears when the
 * next working day starts. Pure functions, no I/O.
 */

export const BROKER_OPENING_HOUR = 9;
export const BROKER_CLOSING_HOUR = 19;

const TIME_ZONE = "America/Sao_Paulo";

/** National fixed holidays, as MM-DD. Carnaval and Corpus Christi stay out (to be confirmed). */
const NATIONAL_FIXED_HOLIDAYS = new Set([
  "01-01", // Confraternização universal
  "04-21", // Tiradentes
  "05-01", // Dia do trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
]);

type SaoPauloParts = { year: number; month: number; day: number; hour: number; weekday: number };

/** Date and hour in São Paulo, plus the weekday (0 = Sunday). */
export function saoPauloParts(now: Date): SaoPauloParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const values = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    weekday: weekdays.indexOf(values.weekday ?? "Sun"),
  };
}

/** Easter Sunday of a Gregorian year (Anonymous Gregorian algorithm). Returns month and day. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Good Friday (Sexta-feira Santa) is two days before Easter Sunday. */
export function goodFridayKey(year: number): string {
  const easter = easterSunday(year);
  const date = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  return `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** True for a national holiday that brokers do not work (fixed dates and Good Friday). */
export function isNationalHoliday(year: number, month: number, day: number): boolean {
  const key = `${pad(month)}-${pad(day)}`;
  return NATIONAL_FIXED_HOLIDAYS.has(key) || key === goodFridayKey(year);
}

/** Monday to Saturday, not a national holiday. */
function isWorkingDay(parts: Pick<SaoPauloParts, "year" | "month" | "day" | "weekday">): boolean {
  return parts.weekday >= 1 && parts.weekday <= 6 && !isNationalHoliday(parts.year, parts.month, parts.day);
}

type CalendarDay = Pick<SaoPauloParts, "year" | "month" | "day" | "weekday">;

/** The calendar day after a given date, computed in UTC so no timezone shifts it. */
function nextDay(day: CalendarDay): CalendarDay {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

export const BROKER_RETURN_IN_INSTANTS = "em instantes";

/** Used in replies: "{{quando}}" becomes one of these phrases. */
export const BROKER_RETURN_PHRASE_PLACEHOLDER = "{{quando}}";

export type BrokerAvailability = {
  /** A broker can answer right now. */
  open: boolean;
  /** Phrase that completes "Um corretor continua a conversa por aqui {quando}". */
  returnPhrase: string;
};

/** Whether a broker answers now, and when the next one does if not. */
export function brokerAvailability(now: Date = new Date()): BrokerAvailability {
  const parts = saoPauloParts(now);
  const openNow = isWorkingDay(parts) && parts.hour >= BROKER_OPENING_HOUR && parts.hour < BROKER_CLOSING_HOUR;
  if (openNow) return { open: true, returnPhrase: BROKER_RETURN_IN_INSTANTS };

  // Before 9h on a working day: the same day starts at 9h.
  if (isWorkingDay(parts) && parts.hour < BROKER_OPENING_HOUR) {
    return { open: false, returnPhrase: "hoje, a partir das 9h" };
  }

  // Otherwise, the next working day, looking at most one week ahead.
  const tomorrow = nextDay(parts);
  let candidate = tomorrow;
  for (let step = 0; step < 7 && !isWorkingDay(candidate); step += 1) candidate = nextDay(candidate);
  const isTomorrow = isWorkingDay(tomorrow) && candidate.day === tomorrow.day && candidate.month === tomorrow.month;
  return { open: false, returnPhrase: isTomorrow ? "amanhã, a partir das 9h" : "no próximo dia útil, a partir das 9h" };
}

/** Puts the return phrase in a message: "{{quando}}" is replaced, other text is kept. */
export function withBrokerReturnPhrase(text: string, now: Date = new Date()): string {
  return text.replaceAll(BROKER_RETURN_PHRASE_PLACEHOLDER, brokerAvailability(now).returnPhrase);
}
