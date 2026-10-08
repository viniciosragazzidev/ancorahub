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

describe("runMetaTenantSync rate limit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("stops the tenant on an adSet rate limit, keeps what was synced and logs a backoff-compatible error", async () => {
    const connection = { id: "connection-1", accessTokenCiphertext: "ciphertext", permissions: ["ads_read"], businessId: "business-1" };
    const account = { adAccountId: "123456789", name: "Account" };
    const updates: Array<{ status?: string; errorDetails?: string }> = [];
    const db = {
      insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined }) }),
      update: (table: unknown) => ({
        set: (values: { status?: string; errorDetails?: string }) => ({
          where: async () => { if (table === schema.metaSyncLogs) updates.push(values); },
        }),
      }),
      select: () => ({
        from: (table: unknown) => ({
          where: () => table === schema.metaConnections
            ? { limit: async () => [connection] }
            : table === schema.metaSyncLogs
              ? { orderBy: () => ({ limit: async () => [] }) }
              : Promise.resolve(table === schema.metaAdAccounts ? [account] : []),
        }),
      }),
    };
    vi.mocked(getDatabase).mockReturnValue(db as unknown as ReturnType<typeof getDatabase>);
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
    expect(updates).toContainEqual(expect.objectContaining({ status: "error", itemsSynced: 2, errorDetails: expect.stringMatching(/request limit reached/i) }));
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("tenant tenant-1"));
  });
});
