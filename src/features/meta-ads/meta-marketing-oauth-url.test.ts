import { describe, expect, it } from "vitest";

import { createMetaMarketingOAuthUrl } from "./meta-marketing-oauth-url";

describe("Meta Marketing OAuth URL", () => {
  it("returns a string suitable for cross-window browser APIs", () => {
    const oauthUrl = createMetaMarketingOAuthUrl({
      appId: "780859815090303",
      redirectUri: "https://crm.ancorasaude.cloud/api/integrations/meta/lead-ads/callback",
      state: "opaque-browser-state",
    });

    expect(typeof oauthUrl).toBe("string");
    expect(oauthUrl).toContain("https://www.facebook.com/v25.0/dialog/oauth?");
    expect(new URL(oauthUrl).searchParams.get("state")).toBe("opaque-browser-state");
  });
});
