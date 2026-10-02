import { describe, expect, it } from "vitest";
import { findRunningDutySchedule, formatDutyStartHour, getDutyOccurrenceLeadWindow, getDutyWindowOnDate, getRelevantDutyWindow, isConfirmationForActiveOccurrence, isDutyWindowActive, listCompletedDutyWindows } from "./duty-presence-domain";

describe("completed duty history", () => {
  const shift = { dayOfWeek: 3, startsAt: "10:00", endsAt: "12:00", timezone: "America/Sao_Paulo" };

  it("accepts only real dates on the configured weekday", () => {
    expect(getDutyWindowOnDate(shift, "2026-09-23")?.startsAt.toISOString()).toBe("2026-09-23T13:00:00.000Z");
    expect(getDutyWindowOnDate(shift, "2026-09-24")).toBeNull();
    expect(getDutyWindowOnDate(shift, "2026-02-30")).toBeNull();
  });

  it("lists a date only after the shift ends and respects the rule validity", () => {
    const rule = { ...shift, validFrom: new Date("2026-09-16T00:00:00.000Z"), validUntil: null };
    expect(listCompletedDutyWindows(rule, new Date("2026-09-23T14:59:00.000Z"), 2).map((entry) => entry.dutyDate)).toEqual(["2026-09-16"]);
    expect(listCompletedDutyWindows(rule, new Date("2026-09-23T15:01:00.000Z"), 2).map((entry) => entry.dutyDate)).toEqual(["2026-09-23", "2026-09-16"]);
  });

  it("ends an overnight occurrence on the next local day", () => {
    const night = { ...shift, startsAt: "22:00", endsAt: "02:00" };
    expect(getDutyWindowOnDate(night, "2026-09-23")?.endsAt.toISOString()).toBe("2026-09-24T05:00:00.000Z");
  });
});

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
  // No rotation — the only schedule on its queue is itself.
  const solo = [shift];

  it("is open-ended while in progress, from 19:00 of the day before (not the last time the schedule ran, a week back)", () => {
    const now = new Date("2026-09-23T14:00:00.000Z"); // Wed 11:00 in São Paulo, mid-shift
    expect(getDutyOccurrenceLeadWindow(shift, solo, now)).toEqual({ since: new Date("2026-09-22T22:00:00.000Z"), until: null });
  });

  it("closes the window at today's own end right after the shift closes, not open-ended", () => {
    const now = new Date("2026-09-23T15:30:00.000Z"); // Wed 12:30 SP, just after close
    expect(getDutyOccurrenceLeadWindow(shift, solo, now)).toEqual({ since: new Date("2026-09-22T22:00:00.000Z"), until: new Date("2026-09-23T15:00:00.000Z") });
  });

  it("scopes a past occurrence's page to only its own window the next day, not open past its close", () => {
    const now = new Date("2026-09-24T14:00:00.000Z"); // Thursday, well after Wednesday's shift
    expect(getDutyOccurrenceLeadWindow(shift, solo, now)).toEqual({ since: new Date("2026-09-22T22:00:00.000Z"), until: new Date("2026-09-23T15:00:00.000Z") });
  });

  it("shows today's not-yet-started occurrence (open-ended, since 19:00 of the day before) instead of last week's", () => {
    const now = new Date("2026-09-30T12:00:00.000Z"); // Wed 09:00 SP — today's own shift starts at 10:00
    expect(getDutyOccurrenceLeadWindow(shift, solo, now)).toEqual({
      since: new Date("2026-09-29T22:00:00.000Z"),
      until: null,
      upcomingStartsAt: new Date("2026-09-30T13:00:00.000Z"),
    });
  });

  it("falls back to show-everything (epoch, no upper bound) for an invalid weekday rather than throwing", () => {
    expect(getDutyOccurrenceLeadWindow({ ...shift, dayOfWeek: 9 }, solo, new Date("2026-09-23T12:00:00.000Z"))).toEqual({ since: new Date(0), until: null });
  });

  it("a plantão whose queues last had a plantão days before counts only from 19:00 of the day before (PRESENCIAL counted from 30/09)", () => {
    const presencial = { dayOfWeek: 5, startsAt: "09:00", endsAt: "13:30", timezone: "America/Sao_Paulo" };
    const lastWeekWednesday = { dayOfWeek: 3, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const now = new Date("2026-10-02T12:30:00.000Z"); // Fri 02/10 09:30 SP
    expect(getDutyOccurrenceLeadWindow(presencial, [presencial, lastWeekWednesday], now)).toEqual({ since: new Date("2026-10-01T22:00:00.000Z"), until: null });
  });

  describe("with a Tue/Wed/Thu rotation sharing the same queue — the reported bug", () => {
    // 09:00–18:00 America/Sao_Paulo == 12:00–21:00 UTC, one row per weekday.
    const tue = { dayOfWeek: 2, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const wed = { dayOfWeek: 3, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const thu = { dayOfWeek: 4, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const rotation = [tue, wed, thu];

    it("pulls the lower bound from yesterday's *different* schedule closing, not this schedule a week back", () => {
      // Thursday 2026-09-24, mid-shift. The queue's Wednesday row closed at
      // 19:00 the day before — every lead since then must count as waiting
      // for today's occurrence, exactly what was reported missing.
      const now = new Date("2026-09-24T16:00:00.000Z"); // Thu 13:00 SP, mid-shift
      expect(getDutyOccurrenceLeadWindow(thu, rotation, now)).toEqual({ since: new Date("2026-09-23T22:00:00.000Z"), until: null });
    });

    it("bounds a past day's own page between the two adjacent days in the rotation, not a week", () => {
      // Viewing Wednesday's page on Thursday: since Tuesday's close, until
      // Wednesday's own close — not last Wednesday, not open past today.
      const now = new Date("2026-09-24T16:00:00.000Z");
      expect(getDutyOccurrenceLeadWindow(wed, rotation, now)).toEqual({
        since: new Date("2026-09-22T22:00:00.000Z"),
        until: new Date("2026-09-23T21:00:00.000Z"),
      });
    });

    it("before today's shift starts, counts leads since yesterday's close — not last week's same weekday", () => {
      // Friday 2026-09-25 08:29 SP, Friday's row starts at 09:00. The page
      // used to show last Friday (18/09); it must show today's occurrence,
      // collecting since Thursday's 18:00 close.
      const fri = { dayOfWeek: 5, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
      const now = new Date("2026-09-25T11:29:00.000Z");
      expect(getDutyOccurrenceLeadWindow(fri, [...rotation, fri], now)).toEqual({
        since: new Date("2026-09-24T22:00:00.000Z"),
        until: null,
        upcomingStartsAt: new Date("2026-09-25T12:00:00.000Z"),
      });
    });
  });
});

describe("findRunningDutySchedule", () => {
  // Monday 28/09/2026 15:40 in São Paulo.
  const now = new Date("2026-09-28T18:40:00Z");
  const monday = { dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo", status: "active" };
  const next = { ...monday, id: "next-monday", validFrom: new Date("2026-10-05T03:00:00Z"), validUntil: new Date("2026-10-06T03:00:00Z") };
  const today = { ...monday, id: "today", validFrom: new Date("2026-09-28T03:00:00Z"), validUntil: new Date("2026-09-29T03:00:00Z") };

  it("picks the plantão valid today, not next Monday's with the same hours", () => {
    expect(findRunningDutySchedule([next, today], now)?.schedule.id).toBe("today");
  });

  it("finds none when only another date's plantão shares the weekday and hours", () => {
    expect(findRunningDutySchedule([next], now)).toBeNull();
  });

  it("ignores archived plantões and ones outside their hours", () => {
    expect(findRunningDutySchedule([{ ...today, status: "archived" }], now)).toBeNull();
    expect(findRunningDutySchedule([today], new Date("2026-09-28T22:00:00Z"))).toBeNull();
  });

  it("keeps an open-ended weekly plantão running", () => {
    expect(findRunningDutySchedule([{ ...monday, id: "weekly", validFrom: new Date("2026-01-01T03:00:00Z"), validUntil: null }], now)?.schedule.id).toBe("weekly");
  });
});
