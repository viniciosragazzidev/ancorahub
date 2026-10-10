import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { resolveRules } from "./catalog";
import { defaultJourneyMissions } from "./missions";
import type { BrokerJourneyFacts } from "./journey-facts";

const mocks = vi.hoisted(() => ({ feature: vi.fn(), facts: vi.fn(), db: { select: vi.fn(), insert: vi.fn(), transaction: vi.fn(), execute: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey", ENGAGEMENT_CAMPAIGNS: "campaigns" }, getFeatureFlag: mocks.feature }));
vi.mock("./journey-facts", () => ({ readJourneyFacts: mocks.facts }));
import { schema } from "@/shared/db";
import { collectJourneyBatch, touchedJourneyBrokers } from "./journey-collector";

const now = new Date("2026-10-10T15:00:00Z");
const writes: { table: unknown; rows: Record<string, unknown>[] }[] = [];
const keys = new Set<string>();
let missing = false;
function query<T>(rows: T[], fail = false) {
  const promise = fail ? Promise.reject(new Error("missing table")) : Promise.resolve(rows);
  // Attach handlers immediately to avoid an artificial unhandled rejection in mocks.
  promise.catch(() => undefined);
  const chain = { where: () => chain, limit: () => chain, then: promise.then.bind(promise), catch: promise.catch.bind(promise) };
  return chain;
}
const facts: BrokerJourneyFacts[] = [{ subject: { brokerId: "broker-text", branchId: "branch", supervisorId: "supervisor-text", dutyScheduleIds: [] }, totalPoints: 490,
  evidence: { fastContacts: 10, consecutivePresences: 5, approvedSales: 0, approvedFamilySales: 0, approvedBusinessSales: 0, onTimeReturns: 0, fullWeeksWithoutSlaBreach: 0, approvedColdLeadSales: 0 },
  days: [{ date: "2026-10-10", hasDuty: false, receivedLeads: 20, evidencedContacts: 20, fastContacts: 10, onTimeContacts: 20, offers: 0, fastAcceptedOffers: 0, serviceLeads: 0, validNotes: 0, returnsDue: 0, returnsCompletedOnTime: 0, overdueReturns: 0, slaBreaches: 0, confirmedPresence: false }],
}];
beforeEach(() => {
  vi.clearAllMocks(); writes.length = 0; keys.clear(); missing = false;
  mocks.feature.mockImplementation(async (flag: string) => flag === "journey" ? "true" : "false");
  mocks.facts.mockResolvedValue(facts);
  mocks.db.select.mockImplementation(() => ({ from: (table: unknown) => query(table === schema.engagementMissions ? defaultJourneyMissions("tenant") : [], missing) }));
  mocks.db.execute.mockResolvedValue([]);
  mocks.db.transaction.mockImplementation(async (callback: (tx: typeof mocks.db) => unknown) => callback(mocks.db));
  mocks.db.insert.mockImplementation((table: unknown) => ({ values: (rows: Record<string, unknown>[]) => {
    writes.push({ table, rows });
    return { onConflictDoUpdate: async () => [], onConflictDoNothing: () => {
      const fresh = rows.filter((r) => {
        const key = String(r.idempotencyKey ?? (r.badgeKey ? `${r.brokerId}:${r.badgeKey}` : r.id));
        if (keys.has(key)) return false;
        keys.add(key); return true;
      });
      const promise = Promise.resolve(fresh);
      return Object.assign(promise, { returning: async () => fresh });
    } };
  } }));
});
const collect = () => collectJourneyBatch({ tenantId: "tenant", brokerIds: ["broker-text"], candidates: [], now, slaMinutes: 15, rules: resolveRules(undefined) });
describe("journey collector", () => {
  it("does nothing when the flag is off", async () => {
    mocks.feature.mockResolvedValue("false");
    expect(await collect()).toMatchObject({ available: false, brokers: 0 });
    expect(mocks.db.select).not.toHaveBeenCalled(); expect(mocks.facts).not.toHaveBeenCalled();
  });
  it("degrades without 0193 and does not begin a failed transaction", async () => {
    missing = true;
    expect(await collect()).toMatchObject({ available: false });
    expect(mocks.db.transaction).not.toHaveBeenCalled(); expect(mocks.facts).not.toHaveBeenCalled();
  });
  it("reads only touched brokers and writes each kind once per batch", async () => {
    expect(await collect()).toMatchObject({ available: true, brokers: 1, bonuses: 1 });
    expect(mocks.facts).toHaveBeenCalledWith("tenant", ["broker-text"], now, 15, false);
    for (const table of [schema.engagementMissionProgress, schema.engagementPointEvents, schema.engagementAchievements, schema.engagementCelebrations]) expect(writes.filter((w) => w.table === table)).toHaveLength(1);
    expect(writes.find((w) => w.table === schema.engagementPointEvents)?.rows[0]).toMatchObject({ ruleKey: "mission.completed", idempotencyKey: "mission:journey:tenant:contacts:broker-text:2026-10-05", tenantId: "tenant" });
    expect(writes.find((w) => w.table === schema.engagementCelebrations)?.rows.map((r) => r.kind)).toEqual(expect.arrayContaining(["mission", "achievement", "level"]));
  });
  it("does not insert another bonus, achievement or celebration on replay", async () => {
    expect(await collect()).toMatchObject({ bonuses: 1 });
    const count = keys.size;
    expect(await collect()).toMatchObject({ bonuses: 0 });
    expect(keys.size).toBe(count);
  });
  it("does not award unsupported sales or Virada", async () => {
    await collect();
    const awards = writes.find((w) => w.table === schema.engagementAchievements)?.rows ?? [];
    expect(awards.map((a) => a.badgeKey)).toEqual(["lightning", "steady_duty"]);
  });
  it("has no tenant scan for an empty batch", async () => {
    await collectJourneyBatch({ tenantId: "tenant", brokerIds: [], candidates: [], now, slaMinutes: 15, rules: resolveRules(undefined) });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it("only revisits the just-closed periods instead of sweeping old unfinished missions", async () => {
    const monday = new Date("2026-10-12T03:10:00Z");
    await touchedJourneyBrokers("tenant", new Date("2026-10-12T03:00:00Z"), monday, 15);
    const mondayQuery = new PgDialect().sqlToQuery(mocks.db.execute.mock.calls[0]![0]);
    expect(mondayQuery.params).toContain("2026-10-11"); expect(mondayQuery.params).toContain("2026-10-05");
    expect(mondayQuery.sql).toContain("period_key in"); expect(mondayQuery.params.some((p) => p instanceof Date)).toBe(false);
    mocks.db.execute.mockClear();
    await touchedJourneyBrokers("tenant", monday, new Date("2026-10-14T03:10:00Z"), 15);
    const wednesdayQuery = new PgDialect().sqlToQuery(mocks.db.execute.mock.calls[0]![0]);
    expect(wednesdayQuery.params).toContain("2026-10-13"); expect(wednesdayQuery.params).not.toContain("2026-10-05");
  });
});
