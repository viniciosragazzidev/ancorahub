import { afterEach, describe, expect, it, vi } from "vitest";

import { getDatabase, schema } from "@/shared/db";

import { MetaGraphApiError, MetaGraphClient } from "./meta-graph-client";
import { runMetaTenantSync } from "./meta-sync-service";

vi.mock("server-only", () => ({}));
vi.mock("./meta-oauth", () => ({ decryptMetaToken: () => "test-token" }));
vi.mock("@/shared/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/db")>();
  return { ...original, getDatabase: vi.fn() };
});

type MetaSyncLogWrite = { kind: "insert" | "update"; values: Record<string, unknown> };

/** Stand-in do drizzle: captura toda escrita em meta_sync_logs na ordem em que o serviço a faz. */
function createDbMock(options: {
  recentLogs?: Array<Record<string, unknown>>;
  adAccounts?: Array<{ adAccountId: string; name: string }>;
} = {}) {
  const { recentLogs = [], adAccounts = [] } = options;
  const connection = { id: "connection-1", accessTokenCiphertext: "ciphertext", permissions: ["ads_read"], businessId: "business-1" };
  const writes: MetaSyncLogWrite[] = [];
  const capture = (kind: "insert" | "update", table: unknown, values: Record<string, unknown>) => {
    if (table === schema.metaSyncLogs) writes.push({ kind, values });
  };
  const db = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        capture("insert", table, values);
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => { capture("update", table, values); },
      }),
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => table === schema.metaConnections
          ? { limit: async () => [connection] }
          : table === schema.metaSyncLogs
            ? { orderBy: () => ({ limit: async () => recentLogs }) }
            : Promise.resolve(table === schema.metaAdAccounts ? adAccounts : []),
      }),
    }),
  };
  return { db, writes };
}

function useDbMock(db: unknown) {
  vi.mocked(getDatabase).mockReturnValue(db as ReturnType<typeof getDatabase>);
}

describe("runMetaTenantSync", () => {
  afterEach(() => vi.restoreAllMocks());

  it("closes an interrupted run before starting and proceeds with a fresh sync", async () => {
    const { db, writes } = createDbMock({
      recentLogs: [{ status: "in_progress", errorDetails: null, startedAt: new Date(Date.now() - 20 * 60_000), completedAt: null }],
    });
    useDbMock(db);
    vi.spyOn(MetaGraphClient.prototype, "fetchGrantedPermissions").mockResolvedValue(["ads_read"]);
    vi.spyOn(MetaGraphClient.prototype, "fetchDatasets").mockResolvedValue([]);

    const result = await runMetaTenantSync("tenant-1");

    expect(result).toMatchObject({ success: true, itemsSynced: 0 });
    expect(writes.map((write) => write.kind)).toEqual(["update", "insert", "update"]);
    expect(writes[0].values).toMatchObject({
      status: "error",
      errorDetails: "Interrompida: o servidor reiniciou durante a sincronização",
      completedAt: expect.any(Date),
    });
    expect(writes[1].values).toMatchObject({ status: "in_progress", tenantId: "tenant-1" });
    expect(writes[2].values).toMatchObject({ status: "success" });
  });

  it("does not count an interrupted run as a Meta rate-limit failure in the backoff", async () => {
    const { db, writes } = createDbMock({
      recentLogs: [
        { status: "error", errorDetails: "Interrompida: o servidor reiniciou durante a sincronização", startedAt: new Date(Date.now() - 50 * 60_000), completedAt: new Date(Date.now() - 45 * 60_000) },
        { status: "error", errorDetails: "User request limit reached", startedAt: new Date(Date.now() - 30 * 60_000), completedAt: new Date(Date.now() - 25 * 60_000) },
      ],
    });
    useDbMock(db);
    vi.spyOn(MetaGraphClient.prototype, "fetchGrantedPermissions").mockResolvedValue(["ads_read"]);
    vi.spyOn(MetaGraphClient.prototype, "fetchDatasets").mockResolvedValue([]);

    const result = await runMetaTenantSync("tenant-1");

    expect(result).toMatchObject({ success: true });
    expect(writes.some((write) => write.kind === "insert")).toBe(true);
  });

  it("stops the tenant on an adSet rate limit, keeps what was synced and logs a backoff-compatible error", async () => {
    const { db, writes } = createDbMock({ adAccounts: [{ adAccountId: "123456789", name: "Account" }] });
    useDbMock(db);
    vi.spyOn(MetaGraphClient.prototype, "fetchGrantedPermissions").mockResolvedValue(["ads_read"]);
    vi.spyOn(MetaGraphClient.prototype, "fetchCampaigns").mockResolvedValue([
      { id: "campaign-1", name: "First" },
      { id: "campaign-2", name: "Second" },
    ]);
    const fetchAdSets = vi.spyOn(MetaGraphClient.prototype, "fetchAdSetsForAccount")
      .mockRejectedValue(new MetaGraphApiError("Rate limit", 429, 17));
    const fetchAds = vi.spyOn(MetaGraphClient.prototype, "fetchAdsForAccount");
    const fetchPixels = vi.spyOn(MetaGraphClient.prototype, "fetchPixels");
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await runMetaTenantSync("tenant-1");

    expect(result).toMatchObject({ success: false, itemsSynced: 2, error: "Meta request limit reached (code 17): Rate limit" });
    expect(fetchAdSets).toHaveBeenCalledExactlyOnceWith("123456789");
    expect(fetchAds).not.toHaveBeenCalled();
    expect(fetchPixels).not.toHaveBeenCalled();
    expect(writes.at(-1)!.values).toMatchObject({ status: "error", itemsSynced: 2, errorDetails: expect.stringMatching(/request limit reached/i) });
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("tenant tenant-1"));
  });
});
