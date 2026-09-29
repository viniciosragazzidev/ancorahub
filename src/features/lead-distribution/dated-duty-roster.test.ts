import { describe, expect, it } from "vitest";
import { selectEffectiveDutyAssignments } from "./dated-duty-roster";

describe("selectEffectiveDutyAssignments", () => {
  const weekly = { id: "weekly", scheduleId: "shift-a", dutyDate: null };
  const weeklyOtherUnit = { id: "weekly-2", scheduleId: "shift-a", dutyDate: null };
  const published = { id: "published", scheduleId: "shift-a", dutyDate: "2026-09-28" };
  const otherShift = { id: "other", scheduleId: "shift-b", dutyDate: null };

  it("ignores published rows entirely when monthly scheduling is off", () => {
    expect(selectEffectiveDutyAssignments([weekly, published, otherShift], "2026-09-28", null)).toEqual([weekly, otherShift]);
  });

  it("replaces the weekly roster of a published plantão in every unit on that date", () => {
    const rows = [weekly, weeklyOtherUnit, published, otherShift];
    expect(selectEffectiveDutyAssignments(rows, "2026-09-28", new Set(["shift-a"]))).toEqual([published, otherShift]);
  });

  it("keeps the weekly roster on other dates and when the plantão has no published broker", () => {
    expect(selectEffectiveDutyAssignments([weekly, published, otherShift], "2026-09-29", new Set())).toEqual([weekly, otherShift]);
  });
});
