import { describe, expect, it } from "vitest";

import { effectiveNoticeSetting, teamNoticeByKey, teamNoticeForPurpose } from "./catalog";
import { decideTeamNotice } from "./decision";
import { evaluateDeliveryGuard, isBusinessHours, nextBusinessOpening, type GuardInput } from "./guard";

// Wednesday 30/09/2026, 10:00 in São Paulo (13:00Z).
const wednesdayMorning = new Date("2026-09-30T13:00:00Z");

function input(overrides: Omit<Partial<GuardInput>, "recipient" | "number"> & { recipient?: Partial<GuardInput["recipient"]>; number?: GuardInput["number"] } = {}): GuardInput {
  return {
    noticeClass: "informative",
    now: wednesdayMorning,
    createdAt: wednesdayMorning,
    channel: "company_number",
    random: 0,
    ...overrides,
    recipient: { lastSentAt: null, sentLastHour: 0, sentToday: 0, remindersToday: 0, duplicateRecently: false, ...overrides.recipient },
    number: overrides.number === undefined ? { lastSentAt: null, sentLastHour: 0, sentToday: 0, connectedAt: new Date("2026-08-01T12:00:00Z") } : overrides.number,
  };
}

describe("business hours", () => {
  it("is Mon–Fri 08:00–18:00 in São Paulo", () => {
    expect(isBusinessHours(wednesdayMorning)).toBe(true);
    expect(isBusinessHours(new Date("2026-09-30T21:00:00Z"))).toBe(false); // Wed 18:00
    expect(isBusinessHours(new Date("2026-10-03T13:00:00Z"))).toBe(false); // Saturday
  });

  it("opens next at 08:00 of the next weekday", () => {
    expect(nextBusinessOpening(new Date("2026-10-02T22:00:00Z")).toISOString()).toBe("2026-10-05T11:00:00.000Z"); // Fri 19:00 → Mon 08:00
    expect(nextBusinessOpening(new Date("2026-09-30T09:00:00Z")).toISOString()).toBe("2026-09-30T11:00:00.000Z"); // Wed 06:00 → Wed 08:00
  });
});

describe("delivery guard", () => {
  it("never limits new lead and lead information, even on a Saturday night", () => {
    const saturdayNight = new Date("2026-10-03T23:30:00Z");
    expect(evaluateDeliveryGuard(input({ noticeClass: "critical", now: saturdayNight, recipient: { sentToday: 40, sentLastHour: 20, lastSentAt: new Date(saturdayNight.getTime() - 1_000) } }))).toEqual({ kind: "now" });
  });

  it("keeps only a few seconds between two company-number messages for critical notices", () => {
    const result = evaluateDeliveryGuard(input({ noticeClass: "critical", number: { lastSentAt: new Date(wednesdayMorning.getTime() - 1_000), sentLastHour: 0, sentToday: 0, connectedAt: null } }));
    expect(result).toEqual({ kind: "hold", until: new Date(wednesdayMorning.getTime() + 2_000), reason: "number_spacing" });
  });

  it("does not space Meta sends by the company number", () => {
    expect(evaluateDeliveryGuard(input({ noticeClass: "critical", channel: "meta", number: { lastSentAt: wednesdayMorning, sentLastHour: 99, sentToday: 999, connectedAt: null } }))).toEqual({ kind: "now" });
  });

  it("holds informative notices until business hours open", () => {
    const fridayEvening = new Date("2026-10-02T22:00:00Z");
    expect(evaluateDeliveryGuard(input({ now: fridayEvening, createdAt: fridayEvening }))).toEqual({ kind: "hold", until: new Date("2026-10-05T11:00:00Z"), reason: "outside_business_hours" });
  });

  it("allows at most 2 reminders per person per day and drops stale or repeated ones", () => {
    expect(evaluateDeliveryGuard(input({ noticeClass: "reminder", recipient: { remindersToday: 2 } }))).toEqual({ kind: "drop", reason: "reminder_daily_limit" });
    expect(evaluateDeliveryGuard(input({ noticeClass: "reminder", recipient: { remindersToday: 1 } }))).toEqual({ kind: "now" });
    expect(evaluateDeliveryGuard(input({ noticeClass: "reminder", createdAt: new Date(wednesdayMorning.getTime() - 13 * 3_600_000) }))).toEqual({ kind: "drop", reason: "stale_reminder" });
    expect(evaluateDeliveryGuard(input({ recipient: { duplicateRecently: true } }))).toEqual({ kind: "drop", reason: "duplicate" });
  });

  it("spaces and caps messages to the same person", () => {
    expect(evaluateDeliveryGuard(input({ recipient: { lastSentAt: new Date(wednesdayMorning.getTime() - 20_000) } }))).toEqual({ kind: "hold", until: new Date(wednesdayMorning.getTime() + 40_000), reason: "recipient_spacing" });
    expect(evaluateDeliveryGuard(input({ recipient: { sentLastHour: 4 } }))).toMatchObject({ kind: "hold", reason: "recipient_hourly_limit" });
    expect(evaluateDeliveryGuard(input({ recipient: { sentToday: 15 } }))).toMatchObject({ kind: "hold", reason: "recipient_daily_limit" });
  });

  it("protects the company number: 8–15 s apart, hourly and daily caps, lower while warming up", () => {
    const lastSentAt = new Date(wednesdayMorning.getTime() - 5_000);
    expect(evaluateDeliveryGuard(input({ random: 0.5, number: { lastSentAt, sentLastHour: 0, sentToday: 0, connectedAt: null } }))).toEqual({ kind: "hold", until: new Date(lastSentAt.getTime() + 11_500), reason: "number_spacing" });
    expect(evaluateDeliveryGuard(input({ number: { lastSentAt: null, sentLastHour: 40, sentToday: 40, connectedAt: null } }))).toMatchObject({ kind: "hold", reason: "number_hourly_limit" });
    expect(evaluateDeliveryGuard(input({ number: { lastSentAt: null, sentLastHour: 15, sentToday: 15, connectedAt: new Date(wednesdayMorning.getTime() - 2 * 86_400_000) } }))).toMatchObject({ kind: "hold", reason: "number_hourly_limit" });
    expect(evaluateDeliveryGuard(input({ number: { lastSentAt: null, sentLastHour: 0, sentToday: 250, connectedAt: null } }))).toMatchObject({ kind: "hold", reason: "number_daily_limit" });
  });
});

describe("team notice decision", () => {
  const number = { id: "waha-1", connected: true, pausedUntil: null };
  const now = wednesdayMorning;

  it("uses the catalog defaults: reminders and expired offers off, lead notices on, Meta only", () => {
    expect(effectiveNoticeSetting(teamNoticeByKey("LEAD_ASSIGNMENT_EXPIRED")!, null)).toEqual({ enabled: false, channel: "meta", freeMessageIds: [] });
    expect(effectiveNoticeSetting(teamNoticeByKey("LEAD_FEEDBACK_REMINDER")!, null).enabled).toBe(false);
    expect(effectiveNoticeSetting(teamNoticeByKey("LEAD_ASSIGNMENT_CONFIRMED")!, null)).toEqual({ enabled: true, channel: "meta", freeMessageIds: [] });
    expect(teamNoticeForPurpose("leadAssignmentConfirmed")?.class).toBe("critical");
  });

  it("never sends a disabled notice through another channel", () => {
    const notice = teamNoticeByKey("TASK_REMINDER")!;
    expect(decideTeamNotice(notice, { enabled: false, channel: "company_number", freeMessageIds: [] }, number, now)).toEqual({ action: "skip", reason: "disabled" });
    expect(decideTeamNotice(notice, { enabled: false, channel: "meta", freeMessageIds: [] }, null, now)).toEqual({ action: "skip", reason: "disabled" });
  });

  it("sends a notice set to Meta through Meta only, even with the company number connected", () => {
    const meta = { enabled: true, channel: "meta" as const, freeMessageIds: [] };
    for (const key of ["LEAD_OFFER", "LEAD_ASSIGNMENT", "LEAD_ASSIGNMENT_CONFIRMED", "LEAD_ASSIGNMENT_EXPIRED", "DUTY_PRESENCE_CONFIRMATION"]) {
      expect(decideTeamNotice(teamNoticeByKey(key)!, meta, number, now)).toEqual({ action: "send", primary: "meta", wahaNumberId: null, note: null });
    }
  });

  it("goes by the company number and falls back to Meta when it is down, paused or banned", () => {
    const notice = teamNoticeByKey("LEAD_ASSIGNMENT_CONFIRMED")!;
    const setting = { enabled: true, channel: "company_number" as const, freeMessageIds: [] };
    expect(decideTeamNotice(notice, setting, number, now)).toEqual({ action: "send", primary: "company_number", wahaNumberId: "waha-1", note: null });
    expect(decideTeamNotice(notice, setting, { ...number, connected: false }, now)).toEqual({ action: "send", primary: "meta", wahaNumberId: null, note: "company_number_unavailable" });
    expect(decideTeamNotice(notice, setting, { ...number, pausedUntil: new Date(now.getTime() + 60_000) }, now)).toEqual({ action: "send", primary: "meta", wahaNumberId: null, note: "company_number_paused" });
  });

  it("sends the messages typed in the chat through the company number by default, with the channel as the only choice", () => {
    const chat = teamNoticeByKey("BROKER_CHAT")!;
    expect(chat.chat).toBe(true);
    expect(effectiveNoticeSetting(chat, null)).toEqual({ enabled: true, channel: "company_number", freeMessageIds: [] });
    expect(effectiveNoticeSetting(chat, { enabled: false, channel: "meta", freeMessageIds: ["x"] })).toEqual({ enabled: true, channel: "meta", freeMessageIds: [] });
  });

  it("locks only the first-access invitation to Meta", () => {
    const notice = teamNoticeByKey("BROKER_WELCOME")!;
    const setting = effectiveNoticeSetting(notice, { enabled: false, channel: "company_number" });
    expect(setting).toEqual({ enabled: true, channel: "meta", freeMessageIds: [] });
    expect(decideTeamNotice(notice, setting, number, now)).toEqual({ action: "send", primary: "meta", wahaNumberId: null, note: null });
  });

  it("sends the lead offer through Meta only by default", () => {
    const notice = teamNoticeByKey("LEAD_OFFER")!;
    expect(decideTeamNotice(notice, effectiveNoticeSetting(notice, null), number, now)).toEqual({ action: "send", primary: "meta", wahaNumberId: null, note: null });
  });

  it("keeps the presence confirmation always on, Meta by default, with the company number as an option", () => {
    const notice = teamNoticeByKey("DUTY_PRESENCE_CONFIRMATION")!;
    expect(effectiveNoticeSetting(notice, null)).toEqual({ enabled: true, channel: "meta", freeMessageIds: [] });
    expect(effectiveNoticeSetting(notice, { enabled: false, channel: "company_number" })).toEqual({ enabled: true, channel: "company_number", freeMessageIds: [] });
  });
});
