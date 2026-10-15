import { describe, expect, it } from "vitest";

import { compareTrend } from "./trend";

describe("compareTrend", () => {
  it("treats a relative change within five percent as flat", () => {
    expect(compareTrend({ current: 104, previous: 100, higherIsBetter: true })).toMatchObject({ direction: "flat", movement: "flat", changePercent: 4 });
    expect(compareTrend({ current: 95, previous: 100, higherIsBetter: false }).direction).toBe("flat");
  });

  it("maps favorable and unfavorable movement to up and down", () => {
    expect(compareTrend({ current: 120, previous: 100, higherIsBetter: true }).direction).toBe("up");
    expect(compareTrend({ current: 80, previous: 100, higherIsBetter: true }).direction).toBe("down");
    expect(compareTrend({ current: 80, previous: 100, higherIsBetter: false }).direction).toBe("up");
    expect(compareTrend({ current: 120, previous: 100, higherIsBetter: false }).direction).toBe("down");
  });

  it("handles a zero baseline and missing windows", () => {
    expect(compareTrend({ current: 5, previous: 0, higherIsBetter: true })).toMatchObject({ direction: "up", changePercent: null });
    expect(compareTrend({ current: 0, previous: 0, higherIsBetter: false }).direction).toBe("flat");
    expect(compareTrend({ current: null, previous: 3, higherIsBetter: true })).toMatchObject({ direction: "flat", changePercent: null });
  });
});
