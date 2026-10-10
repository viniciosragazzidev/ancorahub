import { JOURNEY_TIME_ZONE, type JourneyWeek } from "./journey-types";

const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: JOURNEY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function journeyDay(now: Date): string {
  const parts = formatter.formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Arithmetic on calendar dates, without depending on the process timezone. */
export function shiftJourneyDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
export function journeyWeek(now: Date): JourneyWeek {
  const day = journeyDay(now);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const startsAt = shiftJourneyDay(day, -((weekday + 6) % 7));
  return { periodKey: startsAt, startsAt, endsAt: shiftJourneyDay(startsAt, 7) };
}
/** Midnight conversion also respects historical São Paulo daylight saving. */
export function journeyMidnight(day: string): Date {
  const target = Date.parse(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: JOURNEY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = parts.formatToParts(new Date(instant));
    const get = (type: string) => Number(p.find((item) => item.type === type)!.value);
    const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    instant += target - local;
  }
  return new Date(instant);
}
