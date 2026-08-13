import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { exchangeCodeForLongLivedToken, discoverAssets, fetchGrantedPermissions, completeMetaConnectionAttempt } = vi.hoisted(() => ({
  exchangeCodeForLongLivedToken: vi.fn(),
  discoverAssets: vi.fn(),
  fetchGrantedPermissions: vi.fn(),
  completeMetaConnectionAttempt: vi.fn(),
}));

vi.mock("@/features/meta-ads/meta-oauth", () => ({ exchangeCodeForLongLivedToken }));
vi.mock("@/features/meta-ads/meta-connection-attempts", () => ({ completeMetaConnectionAttempt }));
vi.mock("@/features/meta-ads/meta-graph-client", () => ({
  MetaGraphClient: class {
    discoverAssets = discoverAssets;
    fetchGrantedPermissions = fetchGrantedPermissions;
  },
}));

import { GET } from "./route";

function request(query = "code=oauth-code&state=opaque-state") {
  return new NextRequest(`https://crm.ancorasaude.cloud/api/integrations/meta/lead-ads/callback?${query}`);
}

describe("GET /api/integrations/meta/lead-ads/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForLongLivedToken.mockResolvedValue({ accessToken: "server-only-token", expiresIn: 3600 });
    discoverAssets.mockResolvedValue({ business: { id: "business-1", name: "Corretora" }, pages: [], adAccounts: [], whatsapp: null, pixels: [], datasets: [] });
    fetchGrantedPermissions.mockResolvedValue(["pages_show_list", "leads_retrieval"]);
    completeMetaConnectionAttempt.mockResolvedValue({ id: "attempt-1" });
  });

  it("returns only a verified attempt id to the opener", async () => {
    const response = await GET(request());
    const html = await response.text();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain('"META_MARKETING_AUTH_SUCCESS"');
    expect(html).toContain('"attempt-1"');
    expect(html).not.toContain("server-only-token");
  });

  it("returns a safe stage code when asset discovery fails", async () => {
    discoverAssets.mockRejectedValue(new Error("provider failure"));
    const response = await GET(request());
    const html = await response.text();

    expect(html).toContain('"META_MARKETING_AUTH_ERROR"');
    expect(html).toContain('"asset_discovery_failed"');
    expect(html).not.toContain("provider failure");
  });

  it("does not attempt an OAuth exchange without both callback parameters", async () => {
    const response = await GET(request("state=opaque-state"));
    const html = await response.text();

    expect(exchangeCodeForLongLivedToken).not.toHaveBeenCalled();
    expect(html).toContain('"missing_parameters"');
  });
});
