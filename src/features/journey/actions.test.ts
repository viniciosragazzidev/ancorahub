import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ context: vi.fn(), flag: vi.fn(), tag: vi.fn(), db: { transaction: vi.fn(), update: vi.fn(), insert: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey" }, getFeatureFlag: mocks.flag }));
vi.mock("next/cache", () => ({ updateTag: mocks.tag }));
import { schema } from "@/shared/db";
import { markJourneyCelebrationsSeenAction, setRankingOptOutAction } from "./actions";
const conditions: { sql: string; params: unknown[] }[] = [];
const updates: unknown[] = [];
const audits: unknown[] = [];
let rows: { id: string }[];
beforeEach(() => {
  vi.clearAllMocks(); conditions.length = 0; updates.length = 0; audits.length = 0;
  rows = [{ id: "own-id" }];
  mocks.context.mockResolvedValue({ tenantId: "tenant-text", userId: "broker-text", role: "broker" });
  mocks.flag.mockResolvedValue("true");
  mocks.db.transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
  mocks.db.update.mockImplementation(() => ({ set: (value: unknown) => { updates.push(value); return { where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => { conditions.push(new PgDialect().sqlToQuery(condition)); return { returning: async () => rows }; } }; } }));
  mocks.db.insert.mockImplementation(() => ({ values: async (value: unknown) => { audits.push(value); } }));
});
describe("journey actions", () => {
  it("marks at most 20 own unseen celebrations with tenant protection and audit", async () => {
    expect(await markJourneyCelebrationsSeenAction([" own-id ", "own-id", "foreign-id"])).toEqual({ ok: true });
    expect(mocks.db.update).toHaveBeenCalledWith(schema.engagementCelebrations);
    expect(conditions[0]?.sql).toContain('"tenant_id"');
    expect(conditions[0]?.sql).toContain('"user_id"');
    expect(conditions[0]?.sql).toContain('"seen_at" is null');
    expect(conditions[0]?.params).toEqual(["tenant-text", "broker-text", "own-id", "foreign-id"]);
    expect(audits[0]).toMatchObject([{ userId: "broker-text", entidadeId: "tenant-text:own-id", acao: "journey.celebration_seen" }]);
  });
  it("ignores unknown, foreign or already seen ids without producing an audit", async () => {
    rows = [];
    expect(await markJourneyCelebrationsSeenAction(["foreign-id"])).toEqual({ ok: true });
    expect(audits).toEqual([]);
  });
  it.each([[""], ["a".repeat(81)], Array.from({ length: 21 }, (_, i) => String(i))])("rejects invalid ids before accessing context", async (...ids) => {
    expect((await markJourneyCelebrationsSeenAction(ids)).ok).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("accepts an empty batch without opening a transaction", async () => {
    expect(await markJourneyCelebrationsSeenAction([])).toEqual({ ok: true });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
  it.each(["director", "supervisor"])("denies role %s", async (role) => {
    mocks.context.mockResolvedValue({ tenantId: "tenant-text", userId: "user-text", role });
    expect((await markJourneyCelebrationsSeenAction(["event"])).ok).toBe(false);
    expect((await setRankingOptOutAction(true)).ok).toBe(false);
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
  it("denies writes when the flag is off or auth fails", async () => {
    mocks.flag.mockResolvedValue("false");
    expect((await setRankingOptOutAction(true)).ok).toBe(false);
    mocks.context.mockRejectedValue(new Error("unauthenticated"));
    expect((await markJourneyCelebrationsSeenAction(["event"])).ok).toBe(false);
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
  it("updates only own active broker membership and immediately invalidates the tenant placar", async () => {
    expect(await setRankingOptOutAction(true)).toEqual({ ok: true });
    expect(mocks.db.update).toHaveBeenCalledWith(schema.tenantMemberships);
    expect(updates[0]).toMatchObject({ rankingOptOut: true });
    expect(conditions[0]?.params).toEqual(["tenant-text", "broker-text", "broker", "active"]);
    expect(audits[0]).toMatchObject({ acao: "journey.ranking_opt_out_enabled" });
    expect(mocks.tag).toHaveBeenCalledWith("journey-ranking:tenant-text");
  });
  it("allows opting back in", async () => {
    expect(await setRankingOptOutAction(false)).toEqual({ ok: true });
    expect(updates[0]).toMatchObject({ rankingOptOut: false });
    expect(audits[0]).toMatchObject({ acao: "journey.ranking_opt_out_disabled" });
  });
  it("does not invalidate cache or audit when no own membership changed", async () => {
    rows = [];
    expect((await setRankingOptOutAction(true)).ok).toBe(false);
    expect(mocks.tag).not.toHaveBeenCalled(); expect(audits).toEqual([]);
  });
  it("validates booleans on the server", async () => {
    // @ts-expect-error Intentional untrusted payload.
    expect((await setRankingOptOutAction("false")).ok).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("handles a missing migration without leaking database errors", async () => {
    mocks.db.transaction.mockRejectedValue(new Error("column missing"));
    expect(await setRankingOptOutAction(true)).toEqual({ ok: false, message: "Não foi possível salvar. Tente novamente." });
  });
});
