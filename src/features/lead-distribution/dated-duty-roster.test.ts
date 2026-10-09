import { describe, expect, it } from "vitest";
import { selectEffectiveDutyAssignments } from "./dated-duty-roster";

describe("selectEffectiveDutyAssignments", () => {
  const weekly = { id: "weekly", scheduleId: "shift-a", dutyDate: null, brokerId: "w1" };
  const weeklyOtherUnit = { id: "weekly-2", scheduleId: "shift-a", dutyDate: null, brokerId: "w2" };
  const published = { id: "published", scheduleId: "shift-a", dutyDate: "2026-09-28", brokerId: "p1" };
  const otherShift = { id: "other", scheduleId: "shift-b", dutyDate: null, brokerId: "o1" };

  it("ignores published rows entirely when monthly scheduling is off", () => {
    expect(selectEffectiveDutyAssignments([weekly, published, otherShift], "2026-09-28", null)).toEqual([weekly, otherShift]);
  });

  it("adds the weekly roster to the published escala of the date (they add up since 2026-10-09)", () => {
    const rows = [weekly, weeklyOtherUnit, published, otherShift];
    expect(selectEffectiveDutyAssignments(rows, "2026-09-28", new Set(["shift-a"]))).toEqual(rows.filter((row) => row.dutyDate === null || row === published));
  });

  it("keeps the weekly roster on other dates and when the plantão has no published broker", () => {
    expect(selectEffectiveDutyAssignments([weekly, published, otherShift], "2026-09-29", new Set())).toEqual([weekly, otherShift]);
  });

  it("keeps one row per broker when he is on both (the published one)", () => {
    const mine = { id: "w-ana", scheduleId: "shift-a", dutyDate: null, brokerId: "ana" };
    const minePublished = { id: "p-ana", scheduleId: "shift-a", dutyDate: "2026-09-28", brokerId: "ana" };
    const bruno = { id: "w-bruno", scheduleId: "shift-a", dutyDate: null, brokerId: "bruno" };
    expect(selectEffectiveDutyAssignments([mine, minePublished, bruno], "2026-09-28", new Set(["shift-a"]))).toEqual([minePublished, bruno]);
  });
});
