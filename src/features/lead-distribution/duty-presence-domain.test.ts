import { describe, expect, it } from "vitest";
import { formatDutyStartHour, getRelevantDutyWindow, isConfirmationForActiveOccurrence, isDutyWindowActive } from "./duty-presence-domain";

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
