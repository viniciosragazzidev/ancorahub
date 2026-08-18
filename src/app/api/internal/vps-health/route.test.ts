import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";

const getRequiredPlatformAdmin = vi.fn();
const getVpsHealth = vi.fn();

vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin }));
vi.mock("@/lib/server/vps-api", () => ({ getVpsHealth }));

describe("GET /api/internal/vps-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredPlatformAdmin.mockResolvedValue({ userId: "platform-admin", email: "admin@example.test" });
  });

  it("returns a sanitized reachable response for a platform admin", async () => {
    getVpsHealth.mockResolvedValue({
      status: "online",
      service: "corretop-api",
      timestamp: "2026-08-17T18:00:00.000Z",
      checkedAt: "2026-08-17T18:00:01.000Z",
      latencyMs: 73,
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reachable: true,
      latencyMs: 73,
      vps: { status: "ok", service: "corretop-api" },
    });
  });

  it("returns only a stable error code when the VPS is unavailable", async () => {
    getVpsHealth.mockResolvedValue({ status: "unavailable", errorCode: "timeout", checkedAt: "2026-08-17T18:00:01.000Z", latencyMs: 7_000 });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ reachable: false, latencyMs: 7_000, error: "TIMEOUT" });
  });

  it("does not expose diagnostics without a platform-admin session", async () => {
    getRequiredPlatformAdmin.mockRejectedValue(new AuthenticationError("session missing"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHENTICATED" });
    expect(getVpsHealth).not.toHaveBeenCalled();
  });

  it("refuses diagnostics for a non-platform-admin session", async () => {
    getRequiredPlatformAdmin.mockRejectedValue(new AuthorizationError("platform role required"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "ACCESS_DENIED" });
    expect(getVpsHealth).not.toHaveBeenCalled();
  });
});
