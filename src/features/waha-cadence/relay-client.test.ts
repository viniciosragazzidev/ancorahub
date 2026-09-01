import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveWahaRelayBaseUrl } from "./relay-client";

describe("resolveWahaRelayBaseUrl", () => {
  it("uses the same VPS address preferred by the broker Lite connection", () => {
    expect(resolveWahaRelayBaseUrl({
      VPS_API_URL: "https://working-relay.example.com",
      WAHA_RELAY_URL: "https://stale-relay.example.com",
    })).toBe("https://working-relay.example.com");
  });

  it("uses the dedicated relay URL only when the VPS address is absent", () => {
    expect(resolveWahaRelayBaseUrl({
      WAHA_RELAY_URL: "https://relay.example.com/",
    })).toBe("https://relay.example.com");
  });
});
