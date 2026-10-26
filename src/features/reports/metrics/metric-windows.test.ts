import { describe, expect, it } from "vitest";

import { canonicalWindowBounds, isCanonicalMetricWindow } from "./metric-windows";

const now = new Date("2026-10-26T15:30:00-03:00");

describe("canonical metric windows", () => {
  it("keeps 7 and 30 days as equal moving windows", () => {
    const seven = canonicalWindowBounds(7, now);
    expect(seven.current.endsAt).toEqual(now);
    expect(seven.current.startsAt.toISOString()).toBe("2026-10-19T18:30:00.000Z");
    expect(seven.previous.endsAt).toEqual(seven.current.startsAt);
    expect(seven.previous.startsAt.toISOString()).toBe("2026-10-12T18:30:00.000Z");
    const thirty = canonicalWindowBounds(30, now);
    expect(thirty.current.startsAt.toISOString()).toBe("2026-09-26T18:30:00.000Z");
  });

  it("starts today at midnight in São Paulo and compares with the same stretch of yesterday", () => {
    const today = canonicalWindowBounds(1, now);
    expect(today.current.startsAt.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(today.current.endsAt).toEqual(now);
    expect(today.previous.startsAt.toISOString()).toBe("2026-10-25T03:00:00.000Z");
    expect(today.previous.endsAt.toISOString()).toBe("2026-10-25T18:30:00.000Z");
  });

  it("uses the São Paulo date even when UTC is already tomorrow", () => {
    const lateNight = new Date("2026-10-26T23:10:00-03:00");
    expect(canonicalWindowBounds(1, lateNight).current.startsAt.toISOString()).toBe("2026-10-26T03:00:00.000Z");
  });

  it("accepts only the supported windows", () => {
    expect([1, 7, 30].every(isCanonicalMetricWindow)).toBe(true);
    expect([0, 14, "7", null].some(isCanonicalMetricWindow)).toBe(false);
  });
});
