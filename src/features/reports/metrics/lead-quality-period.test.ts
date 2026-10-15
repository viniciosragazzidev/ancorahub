import { describe, expect, it } from "vitest";

import { leadQualityPeriodLabel, leadQualityRange, leadQualityWindow, leadShiftOf, operationDayStart, parseLeadQualityPeriod } from "./lead-quality-period";

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

  it("from 19:00 on, today is the operation day that just started", () => {
    // 02/10 20:00 in São Paulo: the new operation day began at 19:00.
    expect(leadQualityWindow("today", new Date("2026-10-02T23:00:00.000Z"))).toEqual({
      since: new Date("2026-10-02T22:00:00.000Z"),
      until: new Date("2026-10-03T22:00:00.000Z"),
    });
    expect(operationDayStart(new Date("2026-10-02T21:59:00.000Z"))).toEqual(new Date("2026-10-01T22:00:00.000Z"));
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

describe("intervalo com horário e turnos do intervalo", () => {
  it("accepts times on de/até and rejects de after até", () => {
    expect(parseLeadQualityPeriod("2026-10-10T08:00_2026-10-13T18:00")).toBe("2026-10-10T08:00_2026-10-13T18:00");
    expect(parseLeadQualityPeriod("2026-10-13T18:00_2026-10-13T08:00")).toBe(30);
    expect(parseLeadQualityPeriod("2026-10-13T25:00_2026-10-14")).toBe(30);
  });

  it("Turno 1 runs from de to 13:30 of the last day; Turno 2 from there to até", () => {
    const window = leadQualityWindow("2026-10-10T08:00_2026-10-13T18:00", new Date("2026-10-14T12:00:00Z"));
    expect(window.since.toISOString()).toBe("2026-10-10T11:00:00.000Z");
    expect(window.until?.toISOString()).toBe("2026-10-13T21:00:00.000Z");
    expect(window.shiftSplit?.toISOString()).toBe("2026-10-13T16:30:00.000Z");
  });

  it("labels the times", () => {
    expect(leadQualityPeriodLabel("2026-10-10T08:00_2026-10-13T18:00")).toBe("De 10/10 08:00 a 13/10 18:00");
  });
});

describe("um dia só com horário", () => {
  it("08:00 to 18:00 keeps Turno 1 (08:00-13:30) and Turno 2 (13:30-18:00)", () => {
    const window = leadQualityWindow("2026-10-13T08:00_2026-10-13T18:00", new Date("2026-10-14T12:00:00Z"));
    expect(window.since.toISOString()).toBe("2026-10-13T11:00:00.000Z");
    expect(window.shiftSplit?.toISOString()).toBe("2026-10-13T16:30:00.000Z");
    expect(window.since < window.shiftSplit!).toBe(true);
    expect(window.until?.toISOString()).toBe("2026-10-13T21:00:00.000Z");
  });
});
