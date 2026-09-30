import { describe, expect, it } from "vitest";

import { buildBrokerDutyCalendar } from "./duty-calendar";

const now = new Date("2026-09-30T18:00:00.000Z");

function recurring(overrides: Partial<Parameters<typeof buildBrokerDutyCalendar>[0]["weeklyAssignments"][number]> = {}) {
  return {
    assignmentId: "weekly-1",
    scheduleId: "schedule-1",
    scheduleName: "Plantão PME",
    branchName: "Matriz",
    dayOfWeek: 3,
    startsAt: "13:00",
    endsAt: "17:00",
    timezone: "America/Sao_Paulo",
    validFrom: new Date("2026-09-01T00:00:00.000Z"),
    validUntil: null,
    pausedAt: null,
    ...overrides,
  };
}

function published(overrides: Partial<Parameters<typeof buildBrokerDutyCalendar>[0]["publishedAssignments"][number]> = {}) {
  return {
    assignmentId: "dated-1",
    scheduleId: "schedule-1",
    scheduleName: "Plantão PME",
    branchName: "Matriz",
    dutyDate: "2026-10-07",
    startsAt: "13:00",
    endsAt: "17:00",
    timezone: "America/Sao_Paulo",
    pausedAt: null,
    ...overrides,
  };
}

describe("broker Lite duty calendar", () => {
  it("expands remaining valid weekly occurrences in chronological order", () => {
    const result = buildBrokerDutyCalendar({
      now,
      horizonMonths: 3,
      weeklyAssignments: [recurring()],
      publishedAssignments: [],
      monthlySchedulingEnabled: true,
    });

    expect(result.firstMonthKey).toBe("2026-09-01");
    expect(result.endExclusiveKey).toBe("2026-12-01");
    expect(result.occurrences.map(({ dutyDate }) => dutyDate)).toEqual([
      "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28",
      "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25",
    ]);
  });

  it("lets a published date replace that weekly rule and adds only the broker's published occurrence", () => {
    const result = buildBrokerDutyCalendar({
      now,
      horizonMonths: 2,
      weeklyAssignments: [recurring()],
      publishedAssignments: [published()],
      publishedScheduleDates: [{ scheduleId: "schedule-1", dutyDate: "2026-10-07" }],
      monthlySchedulingEnabled: true,
    });

    expect(result.occurrences.find(({ dutyDate }) => dutyDate === "2026-10-07")).toMatchObject({ source: "published", assignmentId: "dated-1" });
    expect(result.occurrences.filter(({ dutyDate }) => dutyDate === "2026-10-07")).toHaveLength(1);
  });

  it("does not show the weekly rule when a published date assigns that schedule to someone else", () => {
    const result = buildBrokerDutyCalendar({
      now,
      horizonMonths: 2,
      weeklyAssignments: [recurring()],
      publishedAssignments: [],
      publishedScheduleDates: [{ scheduleId: "schedule-1", dutyDate: "2026-10-07" }],
      monthlySchedulingEnabled: true,
    });

    expect(result.occurrences.some(({ dutyDate }) => dutyDate === "2026-10-07")).toBe(false);
  });

  it("ignores monthly rows and overrides while monthly scheduling is disabled", () => {
    const result = buildBrokerDutyCalendar({
      now,
      horizonMonths: 2,
      weeklyAssignments: [recurring()],
      publishedAssignments: [published()],
      publishedScheduleDates: [{ scheduleId: "schedule-1", dutyDate: "2026-10-07" }],
      monthlySchedulingEnabled: false,
    });

    expect(result.occurrences).toHaveLength(5);
    expect(result.occurrences.every(({ source }) => source === "weekly")).toBe(true);
  });

  it("keeps an ongoing shift but excludes a shift that has already ended", () => {
    const result = buildBrokerDutyCalendar({
      now: new Date("2026-10-07T15:00:00.000Z"),
      horizonMonths: 1,
      weeklyAssignments: [recurring({ startsAt: "11:00", endsAt: "18:00" })],
      publishedAssignments: [],
      monthlySchedulingEnabled: false,
    });

    expect(result.occurrences[0]).toMatchObject({ dutyDate: "2026-10-07", inProgress: true });
  });

  it("marks overnight shifts and clamps the display horizon to twelve months", () => {
    const result = buildBrokerDutyCalendar({
      now,
      horizonMonths: 48,
      weeklyAssignments: [recurring({ startsAt: "22:00", endsAt: "02:00" })],
      publishedAssignments: [],
      monthlySchedulingEnabled: false,
    });

    expect(result.monthCount).toBe(12);
    expect(result.occurrences[0].endsNextDay).toBe(true);
  });
});
