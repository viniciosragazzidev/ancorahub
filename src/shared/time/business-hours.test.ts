import { describe, expect, it } from "vitest";

import { isWithinBusinessHours, scheduleForBusinessHours } from "./business-hours";

describe("business hours", () => {
  it("accepts weekdays from 08:00 until before 18:00 in Sao Paulo", () => {
    expect(isWithinBusinessHours(new Date("2026-08-24T11:00:00.000Z"))).toBe(true);
    expect(isWithinBusinessHours(new Date("2026-08-24T20:59:00.000Z"))).toBe(true);
    expect(isWithinBusinessHours(new Date("2026-08-24T10:59:00.000Z"))).toBe(false);
    expect(isWithinBusinessHours(new Date("2026-08-24T21:00:00.000Z"))).toBe(false);
  });

  it("schedules work outside the window for the next weekday opening", () => {
    expect(scheduleForBusinessHours(new Date("2026-08-24T10:59:00.000Z")).toISOString()).toBe("2026-08-24T11:00:00.000Z");
    expect(scheduleForBusinessHours(new Date("2026-08-24T21:00:00.000Z")).toISOString()).toBe("2026-08-25T11:00:00.000Z");
    expect(scheduleForBusinessHours(new Date("2026-08-28T22:00:00.000Z")).toISOString()).toBe("2026-08-31T11:00:00.000Z");
    expect(scheduleForBusinessHours(new Date("2026-08-29T15:00:00.000Z")).toISOString()).toBe("2026-08-31T11:00:00.000Z");
  });
});
