import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createWahaRelaySession, resolveWahaRelayBaseUrl, resolveWahaTransport } from "./relay-client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resolveWahaRelayBaseUrl", () => {
  it("prefers the proven VPS/Fastify transport when both endpoints are configured", () => {
    expect(resolveWahaRelayBaseUrl({
      VPS_API_URL: "https://working-relay.example.com",
      WAHA_RELAY_URL: "https://dedicated-relay.example.com",
    })).toBe("https://working-relay.example.com");
    expect(resolveWahaTransport({
      VPS_API_URL: "https://working-relay.example.com",
      WAHA_RELAY_URL: "https://dedicated-relay.example.com",
    })).toBe("fastify");
  });

  it("uses Fastify directly when only VPS_API_URL is configured", () => {
    expect(resolveWahaRelayBaseUrl({ VPS_API_URL: "https://api.example.com/" })).toBe("https://api.example.com");
    expect(resolveWahaTransport({ VPS_API_URL: "https://api.example.com/" })).toBe("fastify");
  });

  it("keeps the dedicated relay available when no Fastify endpoint is configured", () => {
    expect(resolveWahaRelayBaseUrl({ WAHA_RELAY_URL: "https://dedicated-relay.example.com/" })).toBe("https://dedicated-relay.example.com");
    expect(resolveWahaTransport({ WAHA_RELAY_URL: "https://dedicated-relay.example.com/" })).toBe("relay");
  });

  it("creates a corporate session through Fastify without probing the legacy /v1 path", async () => {
    vi.stubEnv("VPS_API_URL", "https://working-api.example.com");
    vi.stubEnv("WAHA_RELAY_URL", "https://stale-relay.example.com");
    vi.stubEnv("WHATSAPP_API_INTERNAL_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "WAITING_QR", qr: "qr-value" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWahaRelaySession("ancora-test", { tenantId: "tenant-1", userId: "user-1" })).resolves.toMatchObject({
      sessionId: "ancora-test",
      status: "connecting",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://working-api.example.com/internal/waha/connections");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      sessionName: "ancora-test",
      tenantId: "tenant-1",
      userId: "user-1",
    }));
  });
});
