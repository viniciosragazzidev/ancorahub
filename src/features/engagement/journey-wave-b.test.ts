import { describe, expect, it } from "vitest";
import { dailyJourneySummary, isJourneySummaryDue } from "./daily-summary";
import { defaultJourneyMissions, evaluateMission, missionBonus } from "./missions";
import type { JourneyDayFacts } from "./journey-types";
const emptyJourneyDay = (date: string): JourneyDayFacts => ({ date, hasDuty: false, receivedLeads: 0, evidencedContacts: 0, fastContacts: 0, onTimeContacts: 0, offers: 0, fastAcceptedOffers: 0, serviceLeads: 0, validNotes: 0, returnsDue: 0, returnsCompletedOnTime: 0, overdueReturns: 0, slaBreaches: 0, confirmedPresence: false });
const subject = { brokerId: "broker-text", branchId: null, supervisorId: null, dutyScheduleIds: [] };
const mission = defaultJourneyMissions("tenant").find((m) => m.metric === "steps.coverage")!;
describe("real stage mission", () => {
  it("shows progress from real eligible leads rather than clicks or the remaining count", () => {
    const now = new Date("2026-10-10T15:00:00Z");
    const days = [{ ...emptyJourneyDay("2026-10-10"), stageEligibleLeads: 5, stagedLeads: 3 }];
    const progress = evaluateMission({ mission, subject, now, days });
    expect(progress).toMatchObject({ progress: 3, target: 5, percentage: 60, remaining: 2, completed: false });
    expect(missionBonus(mission, progress)).toBeNull();
  });
  it("never rewards an empty portfolio or undefined facts", () => {
    const result = evaluateMission({ mission, subject, now: new Date("2026-10-11T04:00:00Z"), date: "2026-10-10", days: [emptyJourneyDay("2026-10-10")] });
    expect(result.eligible).toBe(false); expect(result.completed).toBe(false);
  });
  it("waits until the last day's lead can mature, then pays an idempotent bonus", () => {
    const days = [{ ...emptyJourneyDay("2026-10-10"), stageEligibleLeads: 2, stagedLeads: 2 }];
    expect(evaluateMission({ mission, subject, now: new Date("2026-10-11T03:29:59Z"), date: "2026-10-10", days }).completed).toBe(false);
    const result = evaluateMission({ mission, subject, now: new Date("2026-10-11T03:30:00Z"), date: "2026-10-10", days });
    expect(result.completed).toBe(true);
    expect(missionBonus(mission, result)).toMatchObject({ points: 10, idempotencyKey: "mission:journey:tenant:steps:broker-text:2026-10-10" });
  });
});
describe("end-of-day summary", () => {
  it("starts at 19:00 São Paulo and uses a stable date key", () => {
    expect(isJourneySummaryDue(new Date("2026-10-10T21:59:59Z"))).toBe(false);
    expect(isJourneySummaryDue(new Date("2026-10-10T22:00:00Z"))).toBe(true);
    expect(isJourneySummaryDue(new Date("2026-10-11T02:59:59Z"))).toBe(true);
    expect(isJourneySummaryDue(new Date("2026-10-11T03:00:00Z"))).toBe(false);
    const days = [{ ...emptyJourneyDay("2026-10-10"), receivedLeads: 6, onTimeContacts: 5 }];
    const input = { brokerId: "broker-text", days, points: 85, now: new Date("2026-10-10T22:00:00Z") };
    expect(dailyJourneySummary(input)).toEqual({ key: "daily_summary:broker-text:2026-10-10", payload: { kind: "daily_summary", date: "2026-10-10", received: 6, onTimeContacts: 5, points: 85 } });
    expect(dailyJourneySummary({ ...input, now: new Date("2026-10-11T01:00:00Z") })?.key).toBe(dailyJourneySummary(input)?.key);
  });
  it("uses only today's facts, and skips before 19h or without a day", () => {
    const days = [{ ...emptyJourneyDay("2026-10-09"), receivedLeads: 99 }, { ...emptyJourneyDay("2026-10-10"), receivedLeads: 2 }];
    expect(dailyJourneySummary({ brokerId: "broker-text", days, points: 0, now: new Date("2026-10-10T22:00:00Z") })?.payload.received).toBe(2);
    expect(dailyJourneySummary({ brokerId: "broker-text", days, points: 0, now: new Date("2026-10-10T20:00:00Z") })).toBeNull();
    expect(dailyJourneySummary({ brokerId: "broker-text", days: [], points: 0, now: new Date("2026-10-10T22:00:00Z") })).toBeNull();
  });
});
