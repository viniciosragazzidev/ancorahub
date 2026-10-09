import { addDays, dayOfWeekOf, isValidOn, localDateKey, zonedMidnight } from "@/features/lead-distribution/monthly-duty-plan";

const SAO_PAULO = "America/Sao_Paulo";

export type MemberDutyRosterRow = {
  assignmentId: string;
  assignmentStatus: string;
  assignmentDayOfWeek: number;
  assignmentStartsAt: string;
  assignmentEndsAt: string;
  assignmentValidFrom: Date;
  assignmentValidUntil: Date | null;
  dutyDate: string | null;
  scheduleId: string;
  scheduleName: string;
  scheduleDayOfWeek: number;
  scheduleStartsAt: string;
  scheduleTimezone: string;
  scheduleValidFrom: Date;
  scheduleValidUntil: Date | null;
  scheduleStatus: string;
  attendanceMode: string;
  typeName: string | null;
  typeHue: number | null;
};

export type MemberDutyDay = {
  date: string;
  scheduleId: string;
  scheduleName: string;
  startsAt: string;
  endsAt: string;
  typeName: string | null;
  typeHue: number | null;
  attendanceMode: "online" | "presencial";
  state: "done" | "today" | "upcoming";
  leads: number;
  offersSent: number;
  offersAccepted: number;
  presence: "confirmed" | "pending" | "absent" | null;
};

export type DutyLeadCount = { scheduleId: string | null; date: string; total: number };
export type DutyOfferCount = { scheduleId: string | null; date: string; sent: number; accepted: number };
export type DutyPresenceCount = { scheduleId: string; date: string; status: string; total: number };

export function getMemberDutyDateWindow(now: Date) {
  const todayDateKey = localDateKey(now, SAO_PAULO);
  return {
    todayDateKey,
    fromDateKey: addDays(todayDateKey, -60),
    throughDateKey: addDays(todayDateKey, 45),
  };
}

function shiftStartAt(date: string, time: string, timeZone: string) {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return new Date(zonedMidnight(date, timeZone).getTime() + ((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function validRosterLine(row: MemberDutyRosterRow, date: string) {
  const startsAt = shiftStartAt(date, row.assignmentStartsAt, row.scheduleTimezone);
  return startsAt >= row.assignmentValidFrom && (!row.assignmentValidUntil || startsAt < row.assignmentValidUntil);
}

function normalizeClock(time: string) {
  return time.slice(0, 5);
}

function presenceFor(statuses: DutyPresenceCount[]) {
  if (statuses.some((row) => row.status === "confirmed" && row.total > 0)) return "confirmed" as const;
  if (statuses.some((row) => row.status === "absent" && row.total > 0)) return "absent" as const;
  if (statuses.some((row) => (row.status === "pending" || row.status === "expired") && row.total > 0)) return "pending" as const;
  return null;
}

export function buildMemberDutyDays(input: {
  rosterRows: MemberDutyRosterRow[];
  fromDateKey: string;
  throughDateKey: string;
  todayDateKey: string;
  leadCounts?: DutyLeadCount[];
  offerCounts?: DutyOfferCount[];
  presenceCounts?: DutyPresenceCount[];
}): MemberDutyDay[] {
  const occurrences = new Map<string, { row: MemberDutyRosterRow; date: string }>();
  for (const row of input.rosterRows) {
    if (row.assignmentStatus !== "active" || row.scheduleStatus === "archived") continue;
    const dates: string[] = [];
    if (row.dutyDate) {
      if (row.dutyDate >= input.fromDateKey && row.dutyDate <= input.throughDateKey) dates.push(row.dutyDate);
    } else {
      for (let date = input.fromDateKey; date <= input.throughDateKey; date = addDays(date, 1)) {
        if (dayOfWeekOf(date) === row.assignmentDayOfWeek) dates.push(date);
      }
    }
    for (const date of dates) {
      if (!validRosterLine(row, date) || !isValidOn({
        startsAt: row.scheduleStartsAt,
        timezone: row.scheduleTimezone,
        validFrom: row.scheduleValidFrom,
        validUntil: row.scheduleValidUntil,
      }, date)) continue;
      const key = `${row.scheduleId}:${date}`;
      const previous = occurrences.get(key);
      if (!previous) {
        occurrences.set(key, { row, date });
      } else {
        const startsEarlier = row.assignmentStartsAt < previous.row.assignmentStartsAt;
        const endsLater = row.assignmentEndsAt > previous.row.assignmentEndsAt;
        occurrences.set(key, {
          row: {
            ...(row.dutyDate && !previous.row.dutyDate ? row : previous.row),
            assignmentStartsAt: startsEarlier ? row.assignmentStartsAt : previous.row.assignmentStartsAt,
            assignmentEndsAt: endsLater ? row.assignmentEndsAt : previous.row.assignmentEndsAt,
          },
          date,
        });
      }
    }
  }

  const leadsByScheduleDate = new Map<string, number>();
  const legacyLeadsByDate = new Map<string, number>();
  for (const row of input.leadCounts ?? []) {
    const target = row.scheduleId ? leadsByScheduleDate : legacyLeadsByDate;
    const key = row.scheduleId ? `${row.scheduleId}:${row.date}` : row.date;
    target.set(key, (target.get(key) ?? 0) + Number(row.total || 0));
  }
  const offersByScheduleDate = new Map((input.offerCounts ?? []).filter((row) => row.scheduleId).map((row) => [`${row.scheduleId}:${row.date}`, row]));
  const presencesByScheduleDate = new Map<string, DutyPresenceCount[]>();
  for (const row of input.presenceCounts ?? []) {
    const key = `${row.scheduleId}:${row.date}`;
    const group = presencesByScheduleDate.get(key);
    if (group) group.push(row);
    else presencesByScheduleDate.set(key, [row]);
  }

  // A lead without a recorded plantão counts once per day: on the day's first plantão only.
  const firstOfDay = new Map<string, string>();
  for (const { row, date } of [...occurrences.values()].sort((a, b) => normalizeClock(a.row.assignmentStartsAt).localeCompare(normalizeClock(b.row.assignmentStartsAt)) || a.row.scheduleId.localeCompare(b.row.scheduleId))) {
    if (!firstOfDay.has(date)) firstOfDay.set(date, row.scheduleId);
  }

  const dutyDays: MemberDutyDay[] = [...occurrences.values()].map(({ row, date }): MemberDutyDay => {
    const key = `${row.scheduleId}:${date}`;
    return {
      date,
      scheduleId: row.scheduleId,
      scheduleName: row.scheduleName,
      startsAt: normalizeClock(row.assignmentStartsAt),
      endsAt: normalizeClock(row.assignmentEndsAt),
      typeName: row.typeName,
      typeHue: row.typeHue,
      attendanceMode: row.attendanceMode === "presencial" ? "presencial" : "online",
      state: date < input.todayDateKey ? "done" : date === input.todayDateKey ? "today" : "upcoming",
      leads: (leadsByScheduleDate.get(key) ?? 0) + (firstOfDay.get(date) === row.scheduleId ? legacyLeadsByDate.get(date) ?? 0 : 0),
      offersSent: offersByScheduleDate.get(key)?.sent ?? 0,
      offersAccepted: offersByScheduleDate.get(key)?.accepted ?? 0,
      presence: presenceFor(presencesByScheduleDate.get(key) ?? []),
    };
  });

  return dutyDays.sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt) || a.scheduleId.localeCompare(b.scheduleId));
}
