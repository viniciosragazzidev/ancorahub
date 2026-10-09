import { describe, expect, it } from "vitest";
import { buildMemberDutyDays, getMemberDutyDateWindow, type MemberDutyRosterRow } from "./member-duty-days";

const scheduleId = "schedule-1";

function rosterRow(overrides: Partial<MemberDutyRosterRow> = {}): MemberDutyRosterRow {
  return {
    assignmentId: "assignment-weekly",
    assignmentStatus: "active",
    assignmentDayOfWeek: 1,
    assignmentStartsAt: "09:00:00",
    assignmentEndsAt: "17:00:00",
    assignmentValidFrom: new Date("2026-04-01T00:00:00Z"),
    assignmentValidUntil: null,
    dutyDate: null,
    scheduleId,
    scheduleName: "Plantão comercial",
    scheduleDayOfWeek: 1,
    scheduleStartsAt: "09:00:00",
    scheduleTimezone: "America/Sao_Paulo",
    scheduleValidFrom: new Date("2026-04-01T00:00:00Z"),
    scheduleValidUntil: null,
    scheduleStatus: "active",
    attendanceMode: "online",
    typeName: "PME",
    typeHue: 142,
    ...overrides,
  };
}

describe("member duty days", () => {
  it("expands active weekly rows only on matching days within both validity windows", () => {
    const days = buildMemberDutyDays({ rosterRows: [rosterRow({ assignmentValidUntil: new Date("2026-04-14T12:00:00Z") })], fromDateKey: "2026-04-06", throughDateKey: "2026-04-20", todayDateKey: "2026-04-13" });
    expect(days.map((day) => day.date)).toEqual(["2026-04-06", "2026-04-13"]);
  });

  it("deduplicates a dated row and weekly row for the same schedule date, while combining counts", () => {
    const days = buildMemberDutyDays({
      rosterRows: [rosterRow(), rosterRow({ assignmentId: "assignment-dated", dutyDate: "2026-04-13", assignmentStartsAt: "10:00:00", assignmentEndsAt: "18:00:00", attendanceMode: "presencial" })],
      fromDateKey: "2026-04-13",
      throughDateKey: "2026-04-13",
      todayDateKey: "2026-04-13",
      leadCounts: [{ scheduleId, date: "2026-04-13", total: 2 }, { scheduleId: null, date: "2026-04-13", total: 1 }],
      offerCounts: [{ scheduleId, date: "2026-04-13", sent: 4, accepted: 2 }],
      presenceCounts: [{ scheduleId, date: "2026-04-13", status: "confirmed", total: 1 }],
    });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ state: "today", startsAt: "09:00", endsAt: "18:00", attendanceMode: "presencial", leads: 3, offersSent: 4, offersAccepted: 2, presence: "confirmed" });
  });

  it("labels past, current, and future duty dates", () => {
    const dates = ["2026-04-06", "2026-04-13", "2026-04-20"];
    const days = buildMemberDutyDays({
      rosterRows: dates.map((dutyDate, index) => rosterRow({ assignmentId: `assignment-${index}`, dutyDate })),
      fromDateKey: "2026-04-06",
      throughDateKey: "2026-04-20",
      todayDateKey: "2026-04-13",
    });
    expect(days.map((day) => day.state)).toEqual(["done", "today", "upcoming"]);
  });

  it("builds the 60-day back and 45-day forward window in São Paulo dates", () => {
    expect(getMemberDutyDateWindow(new Date("2026-04-13T02:30:00Z"))).toEqual({
      todayDateKey: "2026-04-12",
      fromDateKey: "2026-02-11",
      throughDateKey: "2026-05-27",
    });
  });

  it("counts a lead without a recorded plantão once a day, on the first plantão", () => {
    const days = buildMemberDutyDays({
      rosterRows: [rosterRow(), rosterRow({ assignmentId: "assignment-afternoon", scheduleId: "schedule-2", scheduleName: "Tarde", assignmentStartsAt: "13:30:00", assignmentEndsAt: "19:00:00" })],
      fromDateKey: "2026-04-13",
      throughDateKey: "2026-04-13",
      todayDateKey: "2026-04-13",
      leadCounts: [{ scheduleId: null, date: "2026-04-13", total: 2 }],
    });
    expect(days.map((day) => [day.scheduleId, day.leads])).toEqual([[scheduleId, 2], ["schedule-2", 0]]);
  });
});
