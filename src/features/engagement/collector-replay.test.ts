import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ flags: vi.fn(), db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey", BROKER_ENGAGEMENT: "engagement" }, getFeatureFlag: mocks.flags }));
vi.mock("./journey-collector", () => ({ collectJourneyBatch: vi.fn(), touchedJourneyBrokers: vi.fn() }));
import { schema } from "@/shared/db";
import { collectTenantPoints, runEngagementCollector } from "./collector";
const now = new Date("2026-10-10T15:00:00Z");
const completedAt = new Date("2026-10-10T14:50:00Z");
const written: Record<string, unknown>[] = [];
const task = (id: string) => ({ id, leadId: "lead", assignedTo: "broker", createdBy: "manager", createdAt: new Date("2026-10-09T10:00:00Z"), dueAt: now, completedAt });
function query(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const q = { where: () => q, limit: () => q, orderBy: () => q, groupBy: () => q, innerJoin: () => q, then: promise.then.bind(promise) };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks(); written.length = 0; mocks.flags.mockResolvedValue("false");
  mocks.db.select.mockImplementation((columns: Record<string, unknown> | undefined) => ({ from: (table: unknown) => {
    if (table === schema.engagementSettings) return query([{ rules: { "return.on_time": { dailyCap: 2 } } }]);
    if (table === schema.tenants) return query([{ sla: "15" }]);
    if (table === schema.tenantMemberships) return query([{ userId: "broker" }]);
    if (table === schema.leadTasks) return query([task("old"), task("new")]);
    if (table === schema.engagementPointEvents) return query(columns?.total
      ? [{ brokerId: "broker", ruleKey: "return.on_time", day: "2026-10-10", total: 1 }]
      : [{ idempotencyKey: "return.on_time:old:broker", points: 5, occurredAt: completedAt, metadata: {}, reversedAt: null }]);
    return query([]);
  } }));
  mocks.db.insert.mockImplementation((table: unknown) => ({ values: (rows: unknown) => {
    if (table === schema.engagementPointEvents) written.push(...rows as Record<string, unknown>[]);
    return { onConflictDoNothing: () => ({ returning: async () => written.map((_, index) => ({ id: String(index) })) }), onConflictDoUpdate: async () => [] };
  } }));
});
it("does not spend the next daily cap slot on the already scored overlap", async () => {
  const result = await collectTenantPoints("tenant", now);
  expect(result.inserted).toBe(1);
  expect(written.map((r) => r.idempotencyKey)).toEqual(["return.on_time:new:broker"]);
  expect(written[0]?.tenantId).toBe("tenant");
});
it("starts the cron with the new journey flag alone, and skips with both flags off", async () => {
  expect(await runEngagementCollector(now)).toEqual({ skipped: "flag_off" });
  expect(mocks.db.select).not.toHaveBeenCalled();
  mocks.flags.mockImplementation(async (flag: string) => flag === "journey" ? "true" : "false");
  mocks.db.select.mockReturnValue({ from: async () => [] });
  expect(await runEngagementCollector(now)).toEqual({ tenants: 0, results: [] });
  expect(mocks.db.select).toHaveBeenCalledTimes(1);
});
