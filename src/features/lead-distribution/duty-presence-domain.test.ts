import { describe, expect, it } from "vitest";
import { formatDutyStartHour, getDutyOccurrenceLeadWindow, getRelevantDutyWindow, isConfirmationForActiveOccurrence, isDutyWindowActive } from "./duty-presence-domain";

describe("duty presence occurrence windows", () => {
  const shift = { dayOfWeek: 3, startsAt: "10:00", endsAt: "12:00", timezone: "America/Sao_Paulo" };

  it("opens the reminder window 30 minutes before local shift start", () => {
    const now = new Date("2026-09-23T12:35:00.000Z"); // Wednesday, 09:35 in São Paulo
    const window = getRelevantDutyWindow(shift, now);
    expect(window?.dutyDate).toBe("2026-09-23");
    expect(window?.startsAt.toISOString()).toBe("2026-09-23T13:00:00.000Z");
    expect(formatDutyStartHour(window!.startsAt, shift.timezone)).toBe("10:00");
    expect(isDutyWindowActive(window, now)).toBe(false);
  });

  it("keeps a late confirmation associated with the same active occurrence", () => {
    const now = new Date("2026-09-23T14:30:00.000Z"); // 11:30 local
    const window = getRelevantDutyWindow(shift, now);
    const confirmation = {
      status: "confirmed", scheduleId: "shift-1", brokerId: "broker-1", dutyDate: "2026-09-23",
      shiftStartsAt: new Date("2026-09-23T13:00:00.000Z"), shiftEndsAt: new Date("2026-09-23T15:00:00.000Z"),
    };
    expect(window?.dutyDate).toBe("2026-09-23");
    expect(isDutyWindowActive(window, now)).toBe(true);
    expect(isConfirmationForActiveOccurrence({ confirmation, assignment: { scheduleId: "shift-1", brokerId: "broker-1" }, window: window!, now })).toBe(true);
    expect(isConfirmationForActiveOccurrence({ confirmation, assignment: { scheduleId: "shift-2", brokerId: "broker-1" }, window: window!, now })).toBe(false);
    expect(isConfirmationForActiveOccurrence({ confirmation: { ...confirmation, dutyDate: "2026-09-30" }, assignment: { scheduleId: "shift-1", brokerId: "broker-1" }, window: window!, now })).toBe(false);
    expect(isConfirmationForActiveOccurrence({ confirmation: { ...confirmation, shiftStartsAt: new Date("2026-09-23T12:00:00.000Z") }, assignment: { scheduleId: "shift-1", brokerId: "broker-1" }, window: window!, now })).toBe(false);
  });

  it("does not keep an occurrence eligible after its shift ends", () => {
    const now = new Date("2026-09-23T15:01:00.000Z");
    const window = getRelevantDutyWindow(shift, now);
    expect(window).toBeNull();
  });

  it("converts using the schedule timezone rather than the server timezone", () => {
    const now = new Date("2026-09-23T12:35:00.000Z");
    const window = getRelevantDutyWindow({ ...shift, timezone: "America/New_York", startsAt: "09:00", endsAt: "11:00" }, now);
    expect(window?.startsAt.toISOString()).toBe("2026-09-23T13:00:00.000Z");
    expect(formatDutyStartHour(window!.startsAt, "America/New_York")).toBe("09:00");
  });
});

describe("getDutyOccurrenceLeadWindow", () => {
  // Wednesday 10:00–12:00 America/Sao_Paulo (UTC-3) — 13:00–15:00 UTC.
  const shift = { dayOfWeek: 3, startsAt: "10:00", endsAt: "12:00", timezone: "America/Sao_Paulo" };

  it("is open-ended from the occurrence's own start while it is currently in progress", () => {
    const now = new Date("2026-09-23T14:00:00.000Z"); // Wed 11:00 in São Paulo, mid-shift
    expect(getDutyOccurrenceLeadWindow(shift, now)).toEqual({ since: new Date("2026-09-23T13:00:00.000Z"), until: null });
  });

  it("closes the window at today's own end right after the shift closes, not open-ended", () => {
    const now = new Date("2026-09-23T15:30:00.000Z"); // Wed 12:30 SP, just after close
    expect(getDutyOccurrenceLeadWindow(shift, now)).toEqual({ since: new Date("2026-09-23T13:00:00.000Z"), until: new Date("2026-09-23T15:00:00.000Z") });
  });

  it("scopes a past occurrence's page to only its own window the next day — the reported bug", () => {
    // Viewing Wednesday's page on Thursday must not keep absorbing Thursday's
    // own leads: bounded to Wednesday's own start/end, not open past its close.
    const now = new Date("2026-09-24T14:00:00.000Z"); // Thursday, well after Wednesday's shift
    expect(getDutyOccurrenceLeadWindow(shift, now)).toEqual({ since: new Date("2026-09-23T13:00:00.000Z"), until: new Date("2026-09-23T15:00:00.000Z") });
  });

  it("reaches back a full week when today is shift day but the shift has not started yet", () => {
    const now = new Date("2026-09-30T12:00:00.000Z"); // Wed 09:00 SP — today's own shift starts at 10:00
    expect(getDutyOccurrenceLeadWindow(shift, now)).toEqual({ since: new Date("2026-09-23T13:00:00.000Z"), until: new Date("2026-09-23T15:00:00.000Z") });
  });

  it("falls back to show-everything (epoch, no upper bound) for an invalid weekday rather than throwing", () => {
    expect(getDutyOccurrenceLeadWindow({ ...shift, dayOfWeek: 9 }, new Date("2026-09-23T12:00:00.000Z"))).toEqual({ since: new Date(0), until: null });
  });
});
