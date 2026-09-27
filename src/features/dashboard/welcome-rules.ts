import { dayOfWeekOf, isValidOn, localDateKey, zonedMidnight } from "@/features/lead-distribution/monthly-duty-plan";

export type WelcomeSchedule = {
  id: string;
  name: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  validFrom: Date;
  validUntil: Date | null;
};

export type UpcomingShift = { dutyDate: string; start: Date; end: Date; running: boolean };

function atTime(dutyDate: string, time: string, timeZone: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(zonedMidnight(dutyDate, timeZone).getTime() + (hours * 60 + minutes) * 60_000);
}

/**
 * The shift of a plantão that is running at `now`, or else its next one inside
 * its validity (same rule as the runtime: the shift starts in [validFrom, validUntil)).
 * A shift ending at or before its start runs past midnight.
 */
export function upcomingShift(schedule: WelcomeSchedule, now: Date, horizonDays = 14): UpcomingShift | null {
  const [year, month, day] = localDateKey(now, schedule.timezone).split("-").map(Number);
  for (let offset = -1; offset <= horizonDays; offset += 1) {
    const dutyDate = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    if (dayOfWeekOf(dutyDate) !== schedule.dayOfWeek || !isValidOn(schedule, dutyDate)) continue;
    const start = atTime(dutyDate, schedule.startsAt, schedule.timezone);
    let end = atTime(dutyDate, schedule.endsAt, schedule.timezone);
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 3600_000);
    if (end.getTime() <= now.getTime()) continue;
    return { dutyDate, start, end, running: start.getTime() <= now.getTime() };
  }
  return null;
}

/** The plantão the dashboard shows first: one running now, else the soonest to start. */
export function pickNextDuty<T extends WelcomeSchedule>(schedules: readonly T[], now: Date) {
  let best: { schedule: T; shift: UpcomingShift } | null = null;
  for (const schedule of schedules) {
    const shift = upcomingShift(schedule, now);
    if (!shift) continue;
    if (!best || shift.start.getTime() < best.shift.start.getTime()) best = { schedule, shift };
  }
  return best;
}
