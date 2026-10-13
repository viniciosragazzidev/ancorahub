import { describe, expect, it } from "vitest";

import { leadQualityPeriodLabel, leadQualityRange, leadQualityWindow, leadShiftOf, parseLeadQualityPeriod } from "./lead-quality-period";

describe("lead quality period", () => {
  it("parses today and the shared day options", () => {
    expect(parseLeadQualityPeriod("today")).toBe("today");
    expect(parseLeadQualityPeriod("3")).toBe(3);
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

  it("the three-day window starts Friday at 19:00 when viewed on Monday", () => {
    // Monday 05/10 at 12:00 in SÃ£o Paulo; include Friday after 19:00.
    expect(leadQualityWindow(3, new Date("2026-10-05T15:00:00.000Z"))).toEqual({
      since: new Date("2026-10-02T22:00:00.000Z"),
      until: null,
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

describe("intervalo de datas (de x até y)", () => {
  it("reads a valid range and rejects reversed, invalid or over a year", () => {
    expect(parseLeadQualityPeriod("2026-10-01_2026-10-13")).toBe("2026-10-01_2026-10-13");
    expect(parseLeadQualityPeriod("2026-10-13_2026-10-01")).toBe(30);
    expect(parseLeadQualityPeriod("2026-02-30_2026-03-01")).toBe(30);
    expect(leadQualityRange("2025-01-01", "2026-10-13")).toBeNull();
  });

  it("covers operation days: from 19h of the day before the first to 19h of the last, in São Paulo", () => {
    const window = leadQualityWindow("2026-10-01_2026-10-12", new Date("2026-10-13T15:00:00Z"));
    expect(window.since.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(window.until?.toISOString()).toBe("2026-10-12T22:00:00.000Z");
  });

  it("stays open when the range reaches today", () => {
    expect(leadQualityWindow("2026-10-10_2026-10-13", new Date("2026-10-13T15:00:00Z")).until).toBeNull();
  });

  it("labels the range", () => {
    expect(leadQualityPeriodLabel("2026-10-01_2026-10-13")).toBe("De 01/10 a 13/10");
    expect(leadQualityPeriodLabel("2026-10-13_2026-10-13")).toBe("Dia 13/10");
  });
});
