import { describe, expect, it, vi } from "vitest";

import { isMetaAdsReadPermissionError, MetaGraphApiError, MetaGraphClient } from "./meta-graph-client";

describe("MetaGraphClient permissions", () => {
  it("reads only granted scopes without exposing the access token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [
        { permission: "ads_read", status: "granted" },
        { permission: "ads_management", status: "declined" },
      ],
    }), { status: 200 }));

    const permissions = await new MetaGraphClient("secret-token").fetchGrantedPermissions();

    expect(permissions).toEqual(["ads_read"]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/me/permissions");
    fetchMock.mockRestore();
  });

  it("identifies only Meta code 200 ad-account permission failures as a reconsent case", () => {
    expect(isMetaAdsReadPermissionError(new MetaGraphApiError("Ad account owner has NOT grant ads_read permission", 403, 200))).toBe(true);
    expect(isMetaAdsReadPermissionError(new MetaGraphApiError("Invalid OAuth access token", 400, 190))).toBe(false);
  });

  it("confirms leadgen only when the Corretop app is subscribed on the Page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "another-app", subscribed_fields: ["leadgen"] },
        { id: "780859815090303", subscribed_fields: ["leadgen"] },
      ],
    }), { status: 200 }));

    await expect(new MetaGraphClient("secret-token").fetchLeadgenSubscription("page_123")).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/page_123/subscribed_apps");
    fetchMock.mockRestore();
  });

  it("does not treat another app's leadgen subscription as this platform's subscription", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "another-app", subscribed_fields: ["leadgen"] }],
    }), { status: 200 }));

    await expect(new MetaGraphClient("secret-token").fetchLeadgenSubscription("page_123")).resolves.toBe(false);
    fetchMock.mockRestore();
  });
});
