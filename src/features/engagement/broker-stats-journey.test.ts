import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ feature: vi.fn(), db: { select: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_ENGAGEMENT: "legacy", BROKER_JOURNEY: "journey" }, getFeatureFlag: mocks.feature }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
import { getBrokerHighlights, getLeadsWithoutStep } from "./broker-stats";
const whereQueries: { sql: string; params: unknown[] }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); whereQueries.length = 0;
  mocks.feature.mockImplementation(async (flag: string) => flag === "journey" ? "true" : "false");
  mocks.db.select.mockImplementation(() => {
    const p = Promise.resolve([]);
    const chain = { from: () => chain, where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => { whereQueries.push(new PgDialect().sqlToQuery(condition)); return chain; }, innerJoin: () => chain, groupBy: () => chain, orderBy: () => chain, limit: () => chain, then: p.then.bind(p) };
    return chain;
  });
});
it("supports the new flag independently and points the mission at leads assigned today", async () => {
  expect(await getBrokerHighlights("tenant", "broker-text", new Date("2026-10-10T15:00:00Z"))).not.toBeNull();
  expect(whereQueries.some((q) => q.params.includes("2026-10-10T03:00:00.000Z"))).toBe(true);
});
it("keeps the legacy member ranking query's all-time unrecorded-lead filter", async () => {
  await getLeadsWithoutStep("tenant", "broker-text", new Date("2026-10-10T15:00:00Z"));
  expect(whereQueries[0]?.params).toContain("tenant"); expect(whereQueries[0]?.params).toContain("broker-text");
  expect(whereQueries[0]?.params.filter((p) => typeof p === "string" && p.includes("T") && p.endsWith("Z"))).toHaveLength(1);
});
it("skips reads if neither journey flag is enabled", async () => {
  mocks.feature.mockResolvedValue("false");
  expect(await getBrokerHighlights("tenant", "broker-text")).toBeNull();
  expect(mocks.db.select).not.toHaveBeenCalled();
});
