import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveWahaRelayBaseUrl, resolveWahaTransport } from "./relay-client";

describe("resolveWahaRelayBaseUrl", () => {
  it("uses a dedicated relay only when it is explicitly configured", () => {
    expect(resolveWahaRelayBaseUrl({
      VPS_API_URL: "https://working-relay.example.com",
      WAHA_RELAY_URL: "https://dedicated-relay.example.com",
    })).toBe("https://dedicated-relay.example.com");
    expect(resolveWahaTransport({
      VPS_API_URL: "https://working-relay.example.com",
      WAHA_RELAY_URL: "https://dedicated-relay.example.com",
    })).toBe("relay");
  });

  it("uses Fastify directly when only VPS_API_URL is configured", () => {
    expect(resolveWahaRelayBaseUrl({ VPS_API_URL: "https://api.example.com/" })).toBe("https://api.example.com");
    expect(resolveWahaTransport({ VPS_API_URL: "https://api.example.com/" })).toBe("fastify");
  });
});
