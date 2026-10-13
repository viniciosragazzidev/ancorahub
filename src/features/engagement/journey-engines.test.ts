import { describe, expect, it } from "vitest";
import { confirmedPresenceSequence, evaluateAchievements } from "./achievements";
import { evaluateLevel, evaluateStreak, JOURNEY_LEVELS } from "./levels";
import { buildTeamInternal, buildTeamLeaderboard, buildUnitLeaderboard, rankBrokers, type BrokerStanding } from "./leaderboard";
import { defaultJourneyMissions, evaluateMission, missionBonus, missionMatches, selectDailyMissions } from "./missions";
import { journeyDay, journeyMidnight, journeyWeek } from "./journey-periods";
import type { AchievementEvidence, JourneyDayFacts, JourneyMission } from "./journey-types";
import { journeyUserIdSchema } from "./journey-validation";

const now = new Date("2026-10-10T15:00:00Z");
const day = (date: string, values: Partial<JourneyDayFacts> = {}): JourneyDayFacts => ({ date, hasDuty: false, receivedLeads: 0, evidencedContacts: 0, fastContacts: 0, onTimeContacts: 0, offers: 0, fastAcceptedOffers: 0, serviceLeads: 0, validNotes: 0, returnsDue: 0, returnsCompletedOnTime: 0, overdueReturns: 0, slaBreaches: 0, confirmedPresence: false, ...values });
const subject = { brokerId: "text-user-id", branchId: "branch", supervisorId: "super", dutyScheduleIds: ["duty"] };
const missions = defaultJourneyMissions("tenant");
const mission = (metric: JourneyMission["metric"]) => missions.find((m) => m.metric === metric)!;
const standing = (id: string, points: number, values: Partial<BrokerStanding> = {}): BrokerStanding => ({ brokerId: id, name: id, imageUrl: null, branchId: "branch", supervisorId: "super", points, previousPoints: 0, optedOut: false, ...values });

describe("São Paulo periods", () => {
  it("keeps Sunday UTC in the previous SP week until Monday midnight", () => {
    expect(journeyWeek(new Date("2026-10-12T02:59:59Z")).periodKey).toBe("2026-10-05");
    expect(journeyWeek(new Date("2026-10-12T03:00:00Z")).periodKey).toBe("2026-10-12");
    expect(journeyDay(new Date("2026-10-12T02:59:59Z"))).toBe("2026-10-11");
    expect(journeyMidnight("2026-10-12").toISOString()).toBe("2026-10-12T03:00:00.000Z");
  });
  it("accepts text user ids, rejects blank and oversized ids", () => {
    expect(journeyUserIdSchema.parse(" text-user-id ")).toBe("text-user-id");
    expect(journeyUserIdSchema.safeParse(" ").success).toBe(false);
    expect(journeyUserIdSchema.safeParse("a".repeat(81)).success).toBe(false);
  });
});
describe("missions", () => {
  it("chooses daily missions based on duty, keeping weekly missions", () => {
    expect(selectDailyMissions(missions, true).map((m) => m.metric)).not.toContain("returns.cleared");
    expect(selectDailyMissions(missions, false).map((m) => m.metric)).not.toContain("offers.fast_coverage");
    expect(selectDailyMissions(missions, false).map((m) => m.metric)).toContain("contacts.evidenced");
  });
  it.each(["contacts.fast_coverage", "offers.fast_coverage", "notes.coverage", "returns.cleared"] as const)("does not complete empty %s", (metric) => {
    const result = evaluateMission({ mission: mission(metric), subject, now, date: "2026-10-09", days: [day("2026-10-09")] });
    expect(result.completed).toBe(false); expect(missionBonus(mission(metric), result)).toBeNull();
  });
  it("returns.cleared does not apply on a day without any return due", () => {
    const result = evaluateMission({ mission: mission("returns.cleared"), subject, now, date: "2026-10-09", days: [day("2026-10-09")] });
    expect(result.eligible).toBe(false);
    expect(result.completed).toBe(false);
  });
  it.each([
    ["contacts.fast_coverage", { receivedLeads: 2, fastContacts: 2 }],
    ["offers.fast_coverage", { offers: 2, fastAcceptedOffers: 2 }],
    ["notes.coverage", { serviceLeads: 12, validNotes: 12 }],
    ["returns.cleared", { returnsDue: 2, overdueReturns: 0 }],
  ] as const)("finalizes %s on closed days with deterministic bonus", (metric, values) => {
    const m = mission(metric);
    const complete = evaluateMission({ mission: m, subject, now, date: "2026-10-09", days: [day("2026-10-09", values)] });
    expect(complete.completed).toBe(true); expect(complete.percentage).toBe(100);
    expect(missionBonus(m, complete)?.idempotencyKey).toBe(`mission:${m.id}:text-user-id:2026-10-09`);
    expect(evaluateMission({ mission: m, subject, now, days: [day("2026-10-10", values)] }).completed).toBe(false);
  });
  it("counts only the target week and evidenced contacts", () => {
    const result = evaluateMission({ mission: mission("contacts.evidenced"), subject, now, days: [day("2026-10-04", { evidencedContacts: 99 }), day("2026-10-05", { evidencedContacts: 20 })] });
    expect(result.periodKey).toBe("2026-10-05"); expect(result.progress).toBe(20); expect(result.completed).toBe(true);
  });
  it("counts distinct days with contact, not contacts per day", () => {
    expect(evaluateMission({ mission: mission("contacts.days_on_time"), subject, now, days: [day("2026-10-05", { onTimeContacts: 20 })] }).progress).toBe(1);
  });
  it("applies every audience dimension and inclusive/exclusive campaign bounds", () => {
    const m: JourneyMission = { ...mission("contacts.evidenced"), kind: "campaign", period: "campaign", startsAt: now.toISOString(), endsAt: "2026-10-11T15:00:00Z", audience: { userIds: [subject.brokerId], branchIds: ["branch"], supervisorIds: ["super"], dutyScheduleIds: ["duty"] } };
    expect(missionMatches(m, subject, now)).toBe(true);
    expect(missionMatches(m, { ...subject, branchId: "other" }, now)).toBe(false);
    expect(missionMatches(m, subject, new Date(m.endsAt!))).toBe(false);
    expect(missionMatches({ ...m, status: "inactive" }, subject, now)).toBe(false);
  });
  it("preserves the first completion on replay", () => {
    const result = evaluateMission({ mission: mission("contacts.evidenced"), subject, now, days: [], previousCompletedAt: "2026-10-09T20:00:00.000Z" });
    expect(result.completedAt).toBe("2026-10-09T20:00:00.000Z");
  });
});
describe("achievements", () => {
  const evidence: AchievementEvidence = { fastContacts: 10, consecutivePresences: 5, approvedSales: 1, approvedFamilySales: 1, approvedBusinessSales: 1, onTimeReturns: 20, fullWeeksWithoutSlaBreach: 1, approvedColdLeadSales: 1 };
  it("has eight badges with progress and gates all sale badges", () => {
    const badges = evaluateAchievements({ evidence, salesEnabled: false });
    expect(badges).toHaveLength(8); expect(badges.filter((b) => b.earned)).toHaveLength(4);
    expect(badges.find((b) => b.key === "first_sale")?.enabled).toBe(false);
  });
  it("keeps Virada disabled even when sales are enabled", () => {
    const badges = evaluateAchievements({ evidence, salesEnabled: true });
    expect(badges.find((b) => b.key === "first_sale")?.earned).toBe(true);
    expect(badges.find((b) => b.key === "comeback")?.earned).toBe(false);
  });
  it("shows partial progress and retains earned timestamps", () => {
    const badges = evaluateAchievements({ evidence: { ...evidence, fastContacts: 7 }, salesEnabled: false, earned: { lightning: "2026-10-09T20:00:00Z" } });
    expect(badges[0]).toMatchObject({ current: 7, target: 10, percentage: 70, earned: true, earnedAt: "2026-10-09T20:00:00Z" });
  });
  it("counts own confirmations, breaks on absences and ignores nonduty dates", () => {
    expect(confirmedPresenceSequence([
      { date: "2026-10-01", status: "confirmed", confirmedBy: null },
      { date: "2026-10-03", status: "confirmed", confirmedBy: null },
      { date: "2026-10-04", status: "confirmed", confirmedBy: "manager" },
      { date: "2026-10-05", status: "confirmed", confirmedBy: null },
      { date: "2026-10-10", status: "pending", confirmedBy: null },
    ], "2026-10-10")).toBe(2);
  });
});
describe("levels and duty streak", () => {
  it.each(JOURNEY_LEVELS)("uses threshold $threshold", (level) => {
    expect(evaluateLevel(level.threshold).level).toEqual(level);
    if (level.index > 0) expect(evaluateLevel(level.threshold - 1).level.index).toBe(level.index - 1);
  });
  it("handles negative/invalid points and max level", () => {
    expect(evaluateLevel(-1).totalPoints).toBe(0); expect(evaluateLevel(NaN).percentage).toBe(0);
    expect(evaluateLevel(99_999)).toMatchObject({ nextLevel: null, pointsToNext: 0, percentage: 100 });
  });
  it("skips nonduty days and today's unfinished shift, breaks on breached duty", () => {
    expect(evaluateStreak([day("2026-10-05", { hasDuty: true }), day("2026-10-06", { slaBreaches: 9 }), day("2026-10-07", { hasDuty: true }), day("2026-10-08", { hasDuty: true, slaBreaches: 1 }), day("2026-10-09", { hasDuty: true }), day("2026-10-10", { hasDuty: true, slaBreaches: 1 })], "2026-10-10")).toEqual({ current: 1, best: 2, lastDutyDate: "2026-10-09" });
  });
});
describe("leaderboards", () => {
  const week = journeyWeek(now);
  it("ranks ties equally and compares with the previous week", () => {
    const rows = rankBrokers([standing("a", 10, { previousPoints: 1 }), standing("b", 10, { previousPoints: 20 }), standing("c", 5, { previousPoints: 10 })]);
    expect(rows.map((r) => r.position)).toEqual([1, 1, 3]); expect(rows[0]?.positionChange).toBe(2);
  });
  it("hides opted-out brokers from podium but keeps their own rank and gap", () => {
    const board = buildUnitLeaderboard(week, [standing("a", 100, { optedOut: true }), standing("b", 60), standing("c", 10)], "a");
    expect(board.topThree.map((r) => r.brokerId)).toEqual(["b", "c"]); expect(board.self?.position).toBe(1); expect(board.gapToNext).toBeNull();
    expect(buildUnitLeaderboard(week, [standing("a", 100), standing("b", 60), standing("c", 10)], "c").gapToNext).toBe(50);
  });
  it("never reveals an opted-out broker through the gap, the position or the count", () => {
    const board = buildUnitLeaderboard(week, [standing("a", 100), standing("hidden", 70, { optedOut: true }), standing("c", 40)], "c");
    expect(board.gapToNext).toBe(60);
    expect(board.self?.position).toBe(2);
    expect(board.totalParticipants).toBe(2);
    expect(board.topThree.map((r) => r.brokerId)).toEqual(["a", "c"]);
  });
  it("ranks teams by mean, excludes empty teams", () => {
    const board = buildTeamLeaderboard(week, [standing("a", 100), standing("b", 0), standing("c", 80, { supervisorId: "small" })], [
      { supervisorId: "super", name: "Large", imageUrl: null, branchId: "branch" },
      { supervisorId: "small", name: "Small", imageUrl: null, branchId: "branch" },
      { supervisorId: "empty", name: "Empty", imageUrl: null, branchId: "branch" },
    ]);
    expect(board.teams.map((r) => r.supervisorId)).toEqual(["small", "super"]); expect(board.teams[1]?.averagePoints).toBe(50);
  });
  it("keeps team scope and opt-out in internal rankings", () => {
    const rows = [standing("a", 10, { optedOut: true }), standing("b", 5), standing("other", 99, { supervisorId: "other" })];
    expect(buildTeamInternal(week, rows, "super").brokers.map((r) => r.brokerId)).toEqual(["b"]);
    expect(buildTeamInternal(week, rows, "super", "a").brokers.map((r) => r.brokerId)).toEqual(["a", "b"]);
  });
  it("returns stable empty states", () => {
    expect(buildUnitLeaderboard(week, [], "absent")).toMatchObject({ self: null, gapToNext: null, topThree: [], totalParticipants: 0 });
    expect(buildTeamLeaderboard(week, [], []).teams).toEqual([]);
  });
});
