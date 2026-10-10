import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ flags: vi.fn(), facts: vi.fn(), cache: vi.fn(), db: { select: vi.fn(), execute: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown, key: unknown, options: unknown) => { mocks.cache(key, options); return fn; } }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey", TEAM_RANKING: "ranking", ENGAGEMENT_CAMPAIGNS: "campaigns" }, getFeatureFlag: mocks.flags }));
vi.mock("./journey-facts", () => ({ readJourneyFacts: mocks.facts }));
import { schema } from "@/shared/db";
import { getBrokerJourneyData, getPendingJourneyCelebrations, getJourneyDailySummaries } from "./journey-queries";
import { brokerWeek, teamInternal, teamLeaderboard, unitLeaderboard } from "./leaderboard-queries";
const now = new Date("2026-10-10T15:00:00Z");
const fixtures = new Map<unknown, unknown[]>();
let failedTable: unknown;
const accessed: unknown[] = [];
const limits: number[] = [];
const filters: { sql: string; params: unknown[] }[] = [];
const standings = [{ brokerId: "broker-text", name: "Ana", imageUrl: null, branchId: "branch-a", supervisorId: "supervisor-text", points: 25, previousPoints: 10, totalPoints: 500, optedOut: true }, { brokerId: "other", name: "Bea", imageUrl: null, branchId: "branch-b", supervisorId: "other-super", points: 100, previousPoints: 200, totalPoints: 1_000, optedOut: false }];
function query(table: unknown) {
  accessed.push(table);
  const promise = table === failedTable ? Promise.reject(new Error("table absent")) : Promise.resolve(fixtures.get(table) ?? []);
  promise.catch(() => undefined);
  const q = { where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => { filters.push(new PgDialect().sqlToQuery(condition)); return q; }, innerJoin: () => q, orderBy: () => q, limit: (n: number) => { limits.push(n); return q; }, then: promise.then.bind(promise), catch: promise.catch.bind(promise) };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks(); fixtures.clear(); accessed.length = 0; limits.length = 0; filters.length = 0; failedTable = undefined;
  mocks.flags.mockImplementation(async (flag: string) => flag === "campaigns" ? "false" : "true");
  mocks.db.select.mockImplementation(() => ({ from: (table: unknown) => query(table) }));
  mocks.db.execute.mockResolvedValue(standings);
  mocks.facts.mockResolvedValue([{ subject: { brokerId: "broker-text", branchId: "branch-a", supervisorId: "supervisor-text", dutyScheduleIds: [] }, days: [], totalPoints: 500,
    evidence: { fastContacts: 0, consecutivePresences: 0, approvedSales: 0, approvedFamilySales: 0, approvedBusinessSales: 0, onTimeReturns: 0, fullWeeksWithoutSlaBreach: 0, approvedColdLeadSales: 0 } }]);
  fixtures.set(schema.tenantMemberships, [{ branchId: "branch-a", optedOut: true }]);
  fixtures.set(schema.tenants, [{ sla: "15" }]);
});
describe("journey reads", () => {
  it("is unavailable without a feature flag and performs no reads", async () => {
    mocks.flags.mockResolvedValue("false");
    expect(await getBrokerJourneyData("tenant-a", "broker-text", now)).toMatchObject({ available: false, ledger: [], optedOut: false });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it("degrades if a new table is absent", async () => {
    failedTable = schema.engagementMissions;
    expect((await getBrokerJourneyData("tenant-a", "broker-text", now)).available).toBe(false);
    expect(mocks.facts).not.toHaveBeenCalled();
  });
  it("returns optedOut and a bounded ledger with original rule keys and reversals", async () => {
    fixtures.set(schema.engagementPointEvents, [{ id: "event", ruleKey: "contact.first", points: 15, metadata: { latencySeconds: 120 }, occurredAt: now, reversedAt: now }]);
    const data = await getBrokerJourneyData("tenant-a", "broker-text", now);
    expect(data).toMatchObject({ available: true, optedOut: true, ledger: [{ id: "event", ruleKey: "contact.first", detail: "Em 2 min", points: 15, reversed: true, occurredAt: now.toISOString() }] });
    expect(limits).toContain(30); expect(data.level.level.name).toBe("Consultor");
  });
  it("polls only unseen celebrations, without reading the ledger or facts", async () => {
    fixtures.set(schema.engagementCelebrations, [{ id: "celebration", userId: "broker-text", kind: "points", payload: { kind: "points", points: 15, ruleKey: "contact.first", label: "Contato" }, priority: 10, createdAt: now, seenAt: null }]);
    expect(await getPendingJourneyCelebrations("tenant-a", "broker-text")).toHaveLength(1);
    expect(accessed).toEqual([schema.engagementCelebrations]); expect(mocks.facts).not.toHaveBeenCalled();
    expect(filters[0]?.params).toEqual(["tenant-a", "broker-text"]);
    expect(filters[0]?.sql).toContain('"seen_at" is null');
  });
  it("returns an empty poll when its table is absent", async () => {
    failedTable = schema.engagementCelebrations;
    expect(await getPendingJourneyCelebrations("tenant-a", "broker-text")).toEqual([]);
  });
  it("does not query the queue or daily summaries while BROKER_JOURNEY is off", async () => {
    mocks.flags.mockResolvedValue("false");
    expect(await getPendingJourneyCelebrations("tenant-a", "broker-text")).toEqual([]);
    expect(await getJourneyDailySummaries("tenant-a", "broker-text")).toEqual([]);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it("keeps seen daily summaries in the conversation without reading business tables", async () => {
    fixtures.set(schema.engagementCelebrations, [{ id: "summary", userId: "broker-text", kind: "daily_summary", payload: { kind: "daily_summary", date: "2026-10-10", received: 6, onTimeContacts: 5, points: 85 }, priority: 10, createdAt: now, seenAt: now }]);
    expect(await getJourneyDailySummaries("tenant-a", "broker-text")).toMatchObject([{ id: "summary", seenAt: now.toISOString() }]);
    expect(accessed).toEqual([schema.engagementCelebrations]); expect(limits).toContain(7);
    expect(mocks.facts).not.toHaveBeenCalled();
  });
});
describe("ranking queries", () => {
  it("binds tenant, SP week dates and excludes reversed ledger rows", async () => {
    expect(await brokerWeek("tenant-a", "broker-text", now)).toMatchObject({ points: 25, previousPoints: 10, pointsChange: 15, totalPoints: 500, periodKey: "2026-10-05" });
    const sql = new PgDialect().sqlToQuery(mocks.db.execute.mock.calls[0]![0]);
    expect(sql.sql).toContain("reversed_at is null"); expect(sql.params).toContain("tenant-a"); expect(sql.params).toContain("2026-10-05");
    expect(sql.params.some((value) => value instanceof Date)).toBe(false);
    expect(mocks.cache).toHaveBeenCalledWith(["journey-standings-v1"], { revalidate: 60, tags: ["journey-ranking:tenant-a"] });
  });
  it("limits a unit to its own branch and retains only own opted-out position", async () => {
    const result = await unitLeaderboard("tenant-a", "branch-a", "broker-text", now);
    expect(result.totalParticipants).toBe(1); expect(result.topThree).toEqual([]); expect(result.self?.brokerId).toBe("broker-text");
  });
  it("uses team profile and excludes members from another unit", async () => {
    fixtures.set(schema.supervisorTeams, [{ supervisorId: "supervisor-text", name: "Equipe Azul", imageUrl: "photo", branchId: "branch-a" }]);
    expect((await teamLeaderboard("tenant-a", "branch-a", now)).teams[0]).toMatchObject({ name: "Equipe Azul", imageUrl: "photo", activeBrokers: 1, averagePoints: 25 });
    expect((await teamInternal("tenant-a", "supervisor-text", now)).brokers).toEqual([]);
  });
  it("does not query standings with ranking disabled", async () => {
    mocks.flags.mockResolvedValue("false");
    expect((await unitLeaderboard("tenant-a", "branch-a", "broker-text", now)).topThree).toEqual([]);
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });
  it("degrades on a missing opt-out column or point table", async () => {
    mocks.db.execute.mockRejectedValue(new Error("column absent"));
    expect((await unitLeaderboard("tenant-a", "branch-a", "broker-text", now)).self).toBeNull();
  });
});
