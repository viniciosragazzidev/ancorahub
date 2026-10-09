import {
  dayOfWeekOf,
  isValidOn,
  shiftEnd,
  zonedMidnight,
} from "@/features/lead-distribution/monthly-duty-plan";

export type RecurringBrokerDuty = {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  branchName: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  validFrom: Date;
  validUntil: Date | null;
  pausedAt: Date | null;
};

export type PublishedBrokerDuty = {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  branchName: string | null;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  pausedAt: Date | null;
};

export type PublishedDutyScheduleDate = { scheduleId: string; dutyDate: string };

export type BrokerDutyCalendarOccurrence = {
  id: string;
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  branchName: string | null;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  source: "weekly" | "published";
  paused: boolean;
  inProgress: boolean;
  endsNextDay: boolean;
};

export type BrokerDutyCalendarResult = {
  todayKey: string;
  firstMonthKey: string;
  monthCount: number;
  endExclusiveKey: string;
  occurrences: BrokerDutyCalendarOccurrence[];
};

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDutyCalendarMonths(firstMonthKey: string, amount: number) {
  const [year, month] = firstMonthKey.split("-").map(Number);
  const totalMonths = year * 12 + month - 1 + amount;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = totalMonths % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function shiftStart(schedule: Pick<RecurringBrokerDuty, "startsAt" | "timezone"> | Pick<PublishedBrokerDuty, "startsAt" | "timezone">, dutyDate: string) {
  const [hours, minutes] = schedule.startsAt.split(":").map(Number);
  return new Date(zonedMidnight(dutyDate, schedule.timezone).getTime() + (hours * 60 + minutes) * 60_000);
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function monthKey(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function buildBrokerDutyCalendar(input: {
  now: Date;
  horizonMonths: number;
  weeklyAssignments: readonly RecurringBrokerDuty[];
  publishedAssignments: readonly PublishedBrokerDuty[];
  publishedScheduleDates?: readonly PublishedDutyScheduleDate[];
  monthlySchedulingEnabled: boolean;
}): BrokerDutyCalendarResult {
  const monthCount = Math.min(12, Math.max(1, Math.trunc(input.horizonMonths) || 1));
  const todayKey = dateKeyInTimezone(input.now, DEFAULT_TIMEZONE);
  const firstMonthKey = monthKey(todayKey);
  const endExclusiveKey = addDutyCalendarMonths(firstMonthKey, monthCount);
  // Weekly and published add up (2026-10-09): a weekly occurrence is skipped only when
  // the broker is also on the published escala of that plantão and date (one entry).
  const publishedDates = new Set(
    input.monthlySchedulingEnabled
      ? input.publishedAssignments.map(({ scheduleId, dutyDate }) => `${scheduleId}:${dutyDate}`)
      : [],
  );
  const occurrences: Array<BrokerDutyCalendarOccurrence & { sortAt: number }> = [];

  for (const assignment of input.weeklyAssignments) {
    for (let dutyDate = todayKey; dutyDate < endExclusiveKey; dutyDate = nextDateKey(dutyDate)) {
      if (dayOfWeekOf(dutyDate) !== assignment.dayOfWeek) continue;
      if (publishedDates.has(`${assignment.scheduleId}:${dutyDate}`)) continue;
      if (!isValidOn(assignment, dutyDate)) continue;

      const startsAt = shiftStart(assignment, dutyDate);
      const endsAt = shiftEnd(assignment, dutyDate);
      if (endsAt.getTime() <= input.now.getTime()) continue;

      occurrences.push({
        id: `weekly:${assignment.assignmentId}:${dutyDate}`,
        assignmentId: assignment.assignmentId,
        scheduleId: assignment.scheduleId,
        scheduleName: assignment.scheduleName,
        branchName: assignment.branchName,
        dutyDate,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        source: "weekly",
        paused: assignment.pausedAt !== null,
        inProgress: startsAt.getTime() <= input.now.getTime(),
        endsNextDay: endsAt.getTime() >= zonedMidnight(dutyDate, assignment.timezone).getTime() + DAY_MS,
        sortAt: startsAt.getTime(),
      });
    }
  }

  if (input.monthlySchedulingEnabled) {
    for (const assignment of input.publishedAssignments) {
      if (assignment.dutyDate < todayKey || assignment.dutyDate >= endExclusiveKey) continue;

      const startsAt = shiftStart(assignment, assignment.dutyDate);
      const endsAt = shiftEnd(assignment, assignment.dutyDate);
      if (endsAt.getTime() <= input.now.getTime()) continue;

      occurrences.push({
        id: `published:${assignment.assignmentId}`,
        assignmentId: assignment.assignmentId,
        scheduleId: assignment.scheduleId,
        scheduleName: assignment.scheduleName,
        branchName: assignment.branchName,
        dutyDate: assignment.dutyDate,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        source: "published",
        paused: assignment.pausedAt !== null,
        inProgress: startsAt.getTime() <= input.now.getTime(),
        endsNextDay: endsAt.getTime() >= zonedMidnight(assignment.dutyDate, assignment.timezone).getTime() + DAY_MS,
        sortAt: startsAt.getTime(),
      });
    }
  }

  occurrences.sort((left, right) => left.sortAt - right.sortAt || left.id.localeCompare(right.id));

  return {
    todayKey,
    firstMonthKey,
    monthCount,
    endExclusiveKey,
    occurrences: occurrences.map(({ sortAt, ...occurrence }) => {
      void sortAt;
      return occurrence;
    }),
  };
}
