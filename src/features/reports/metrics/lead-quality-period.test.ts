import { describe, expect, it } from "vitest";

import { leadQualityWindow, leadShiftOf, parseLeadQualityPeriod } from "./lead-quality-period";

describe("lead quality period", () => {
  it("parses today and the shared day options", () => {
    expect(parseLeadQualityPeriod("today")).toBe("today");
    expect(parseLeadQualityPeriod("7")).toBe(7);
    expect(parseLeadQualityPeriod("13")).toBe(30);
    expect(parseLeadQualityPeriod(undefined)).toBe(30);
  });

  it("today runs from 19:00 of yesterday to 19:00 of today (São Paulo)", () => {
    // 02/10 10:00 in São Paulo (UTC-3)
    expect(leadQualityWindow("today", new Date("2026-10-02T13:00:00.000Z"))).toEqual({
      since: new Date("2026-10-01T22:00:00.000Z"),
      until: new Date("2026-10-02T22:00:00.000Z"),
    });
  });

  it("splits shifts at 13:30 and 19:00", () => {
    expect(leadShiftOf(new Date("2026-10-01T23:00:00.000Z"))).toBe(1); // 20:00
    expect(leadShiftOf(new Date("2026-10-02T03:00:00.000Z"))).toBe(1); // 00:00
    expect(leadShiftOf(new Date("2026-10-02T16:29:00.000Z"))).toBe(1); // 13:29
    expect(leadShiftOf(new Date("2026-10-02T16:30:00.000Z"))).toBe(2); // 13:30
    expect(leadShiftOf(new Date("2026-10-02T20:59:00.000Z"))).toBe(2); // 17:59
    expect(leadShiftOf(new Date("2026-10-02T21:00:00.000Z"))).toBe(2); // 18:00
    expect(leadShiftOf(new Date("2026-10-02T21:59:00.000Z"))).toBe(2); // 18:59
    expect(leadShiftOf(new Date("2026-10-02T22:00:00.000Z"))).toBe(1); // 19:00
  });
});
