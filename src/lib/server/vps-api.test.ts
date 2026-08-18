import { afterEach, describe, expect, it, vi } from "vitest";

const originalUrl = process.env.VPS_API_URL;
const originalInternalToken = process.env.VPS_INTERNAL_API_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUrl === undefined) delete process.env.VPS_API_URL;
  else process.env.VPS_API_URL = originalUrl;
  if (originalInternalToken === undefined) delete process.env.VPS_INTERNAL_API_TOKEN;
  else process.env.VPS_INTERNAL_API_TOKEN = originalInternalToken;
});

describe("getVpsHealth", () => {
  it("returns the validated VPS health with measured latency", async () => {
    process.env.VPS_API_URL = "https://api.crm.ancorasaude.cloud";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", service: "corretop-api", timestamp: "2026-08-17T17:00:00.000Z" }), { status: 200 }),
      ),
    );

    const { getVpsHealth } = await import("./vps-api");
    const health = await getVpsHealth();

    expect(health).toMatchObject({ status: "online", service: "corretop-api", timestamp: "2026-08-17T17:00:00.000Z" });
    expect(health.latencyMs).toEqual(expect.any(Number));
    expect(fetch).toHaveBeenCalledWith(
      "https://api.crm.ancorasaude.cloud/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("reports a timeout without leaking infrastructure details", async () => {
    process.env.VPS_API_URL = "https://api.crm.ancorasaude.cloud";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));

    const { getVpsHealth } = await import("./vps-api");

    await expect(getVpsHealth()).resolves.toMatchObject({ status: "unavailable", errorCode: "timeout" });
  });

  it("does not attempt a request when the private URL is absent", async () => {
    delete process.env.VPS_API_URL;
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    const { getVpsHealth } = await import("./vps-api");
    await expect(getVpsHealth()).resolves.toMatchObject({ status: "unavailable", errorCode: "not_configured" });
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an insecure VPS URL before making a request", async () => {
    process.env.VPS_API_URL = "http://api.crm.ancorasaude.cloud";
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    const { getVpsHealth } = await import("./vps-api");
    await expect(getVpsHealth()).resolves.toMatchObject({ status: "unavailable", errorCode: "invalid_configuration" });
    expect(request).not.toHaveBeenCalled();
  });
});

describe("getVpsInternalPing", () => {
  it("sends the private bearer token only from the server-side client", async () => {
    process.env.VPS_API_URL = "https://api.crm.ancorasaude.cloud";
    process.env.VPS_INTERNAL_API_TOKEN = "private-test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, service: "corretop-api" }), { status: 200 })));

    const { getVpsInternalPing } = await import("./vps-api");
    await expect(getVpsInternalPing()).resolves.toMatchObject({ status: "online", service: "corretop-api" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.crm.ancorasaude.cloud/internal/ping",
      expect.objectContaining({ headers: { Authorization: "Bearer private-test-token" }, cache: "no-store" }),
    );
  });

  it("does not attempt an internal request without the shared token", async () => {
    process.env.VPS_API_URL = "https://api.crm.ancorasaude.cloud";
    delete process.env.VPS_INTERNAL_API_TOKEN;
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    const { getVpsInternalPing } = await import("./vps-api");
    await expect(getVpsInternalPing()).resolves.toMatchObject({ status: "unavailable", errorCode: "not_configured" });
    expect(request).not.toHaveBeenCalled();
  });
});
