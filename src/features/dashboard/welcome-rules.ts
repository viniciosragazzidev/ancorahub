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

export type RunningDutyActivity = { confirmedBrokers: number; leadsToday: number; brokers: number };

/**
 * Among plantões running at the same time, the busiest one: more brokers with
 * confirmed presence, then more leads today, then more brokers on the roster,
 * then the one that started first.
 */
export function pickBusiestRunning<T extends { schedule: { id: string }; shift: UpcomingShift }>(
  candidates: readonly T[],
  activity: ReadonlyMap<string, RunningDutyActivity>,
): T | null {
  const score = (candidate: T) => activity.get(candidate.schedule.id) ?? { confirmedBrokers: 0, leadsToday: 0, brokers: 0 };
  return [...candidates].sort((a, b) => {
    const sa = score(a), sb = score(b);
    return sb.confirmedBrokers - sa.confirmedBrokers
      || sb.leadsToday - sa.leadsToday
      || sb.brokers - sa.brokers
      || a.shift.start.getTime() - b.shift.start.getTime();
  })[0] ?? null;
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
