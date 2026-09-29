import { describe, expect, it } from "vitest";
import {
  getDefaultDutyScheduleMonthKey,
  getOperationalMonthKey,
  groupDutySchedulesByMonth,
} from "./duty-schedule-month-groups";

describe("duty schedule month groups", () => {
  it("groups schedules by their selected validity month and prioritizes current and upcoming months", () => {
    const groups = groupDutySchedulesByMonth([
      { id: "october", validFrom: new Date("2026-10-01T00:00:00.000Z") },
      { id: "august", validFrom: new Date("2026-08-01T00:00:00.000Z") },
      { id: "september", validFrom: new Date("2026-09-01T00:00:00.000Z") },
    ], "2026-09");

    expect(groups.map((group) => group.key)).toEqual(["2026-09", "2026-10", "2026-08"]);
    expect(groups.map((group) => group.label)).toEqual([
      "Setembro de 2026",
      "Outubro de 2026",
      "Agosto de 2026",
    ]);
    expect(groups[1]?.schedules.map((schedule) => schedule.id)).toEqual(["october"]);
  });

  it("opens the current month by default, or the nearest upcoming month when it is empty", () => {
    const withCurrentMonth = groupDutySchedulesByMonth([
      { id: "october", validFrom: new Date("2026-10-01T00:00:00.000Z") },
      { id: "september", validFrom: new Date("2026-09-01T00:00:00.000Z") },
    ], "2026-09");
    const groups = groupDutySchedulesByMonth([
      { id: "october", validFrom: new Date("2026-10-01T00:00:00.000Z") },
      { id: "august", validFrom: new Date("2026-08-01T00:00:00.000Z") },
    ], "2026-09");

    expect(getDefaultDutyScheduleMonthKey(withCurrentMonth, "2026-09")).toBe("2026-09");
    expect(getDefaultDutyScheduleMonthKey(groups, "2026-09")).toBe("2026-10");
    expect(getOperationalMonthKey(new Date("2026-09-23T12:00:00.000Z"))).toBe("2026-09");
  });
});
