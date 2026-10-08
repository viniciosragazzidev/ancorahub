import { describe, expect, it, vi } from "vitest";

import { isMetaAdsReadPermissionError, isMetaRateLimitError, MetaGraphApiError, MetaGraphClient, readMetaUsageHeaders } from "./meta-graph-client";

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

  it.each([4, 17, 32, 613, 80000, 80004, 80014])("identifies Meta rate limit code %i from a paginated request", async (code) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Rate limit", code },
    }), { status: 429 }));

    await expect(new MetaGraphClient("secret-token").fetchCampaigns("123456789"))
      .rejects.toSatisfy(isMetaRateLimitError);
    fetchMock.mockRestore();
  });

  it("confirms leadgen only when the Corretop app is subscribed on the Page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "another-app", subscribed_fields: ["leadgen"] },
        { id: "780859815090303", subscribed_fields: ["leadgen"] },
      ],
    }), { status: 200 }));

    await expect(new MetaGraphClient("secret-token").fetchLeadgenSubscription("1262967620230301")).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/1262967620230301/subscribed_apps");
    fetchMock.mockRestore();
  });

  it("does not treat another app's leadgen subscription as this platform's subscription", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "another-app", subscribed_fields: ["leadgen"] }],
    }), { status: 200 }));

    await expect(new MetaGraphClient("secret-token").fetchLeadgenSubscription("1262967620230301")).resolves.toBe(false);
    fetchMock.mockRestore();
  });

  it("does not call Graph API for malformed persisted asset identifiers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(new MetaGraphClient("secret-token").fetchCampaigns("act_mock_789")).rejects.toMatchObject({ code: 100 });
    await expect(new MetaGraphClient("secret-token").fetchLeadForms("page_mock_456")).rejects.toMatchObject({ code: 100 });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("lists campaigns lightly: 50 per page, without archived or deleted objects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await new MetaGraphClient("secret-token").fetchAdSetsForAccount("123456789");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("fields")).not.toContain("targeting");
    expect(JSON.parse(url.searchParams.get("filtering") ?? "[]")).toEqual([
      { field: "effective_status", operator: "NOT_IN", value: ["ARCHIVED", "DELETED"] },
    ]);
    fetchMock.mockRestore();
  });

  it("retries a rejected filter unfiltered but never retries a rate limit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "bad filter", code: 100 } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "1", name: "A" }] }), { status: 200 }));
    await expect(new MetaGraphClient("secret-token").fetchCampaigns("123456789")).resolves.toHaveLength(1);
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.has("filtering")).toBe(false);

    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ error: { message: "limit", code: 17 } }), { status: 429 }));
    await expect(new MetaGraphClient("secret-token").fetchCampaigns("123456789")).rejects.toSatisfy(isMetaRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("reads the highest usage across the three Meta usage headers", () => {
    const headers = new Headers({
      "x-app-usage": JSON.stringify({ call_count: 10, total_cputime: 20, total_time: 5 }),
      "x-business-use-case-usage": JSON.stringify({ "1": [{ type: "ads_management", call_count: 30, total_cputime: 80, total_time: 1, estimated_time_to_regain_access: 12 }] }),
      "x-ad-account-usage": JSON.stringify({ acc_id_util_pct: 40 }),
    });
    expect(readMetaUsageHeaders(headers)).toEqual({ percent: 80, metric: "x-business-use-case-usage.total_cputime", regainMinutes: 12 });
    expect(readMetaUsageHeaders(new Headers()).percent).toBe(0);
  });

  it("stops before the next call once any usage meter passes 75%", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "x-ad-account-usage": JSON.stringify({ acc_id_util_pct: 76 }) },
    }));
    const client = new MetaGraphClient("secret-token");

    await client.fetchPixels("123456789");
    const stopped = await client.fetchCampaigns("123456789").catch((error: unknown) => error);

    expect(stopped).toSatisfy(isMetaRateLimitError);
    expect((stopped as MetaGraphApiError).message).toMatch(/request limit reached/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("adds estimated_time_to_regain_access from the headers to a rate limit error", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Calls exceeded", code: 80004 } }), {
      status: 429,
      headers: { "x-business-use-case-usage": JSON.stringify({ "1": [{ call_count: 100, estimated_time_to_regain_access: 30 }] }) },
    }));
    const error = await new MetaGraphClient("secret-token").fetchPixels("123456789").catch((caught: unknown) => caught);
    expect((error as MetaGraphApiError).message).toContain("estimated_time_to_regain_access: 30 min");
    fetchMock.mockRestore();
  });
});
