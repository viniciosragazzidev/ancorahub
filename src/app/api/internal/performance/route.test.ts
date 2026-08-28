import { describe, expect, it, vi } from "vitest";

const { recordFrontendMetric } = vi.hoisted(() => ({ recordFrontendMetric: vi.fn() }));

vi.mock("@/shared/observability/metrics", () => ({
  recordFrontendMetric,
  recordApiMetric: vi.fn(),
  logSlowRequest: vi.fn(),
}));

vi.mock("@/shared/observability/request-timing", () => ({
  getRequestTiming: () => undefined,
  getDurations: () => ({ authMs: 0, tenantMs: 0, dbMs: 0 }),
}));

import { POST } from "./route";

describe("POST /api/internal/performance", () => {
  it("accepts bounded telemetry and stores only the top-level route", async () => {
    const response = await POST(new Request("https://crm.ancorasaude.cloud/api/internal/performance", {
      method: "POST",
      body: JSON.stringify({ route: "/leads/5511999999999", metric: "lcp", value: 321.2 }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(recordFrontendMetric).toHaveBeenCalledWith({ route: "/leads", metric: "lcp", value: 321 });
  });

  it("accepts the client route-navigation metric without retaining the query string", async () => {
    const response = await POST(new Request("https://crm.ancorasaude.cloud/api/internal/performance", {
      method: "POST",
      body: JSON.stringify({ route: "/leads?page=2", metric: "route_navigation", value: 187 }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(recordFrontendMetric).toHaveBeenCalledWith({
      route: "/leads",
      metric: "route_navigation",
      value: 187,
    });
  });

  it("rejects malformed and oversized telemetry", async () => {
    const malformed = await POST(new Request("https://crm.ancorasaude.cloud/api/internal/performance", {
      method: "POST",
      body: JSON.stringify({ route: "leads", metric: "unknown", value: -1 }),
      headers: { "content-type": "application/json" },
    }));
    const oversized = await POST(new Request("https://crm.ancorasaude.cloud/api/internal/performance", {
      method: "POST",
      body: "x".repeat(1_025),
      headers: { "content-type": "application/json", "content-length": "1025" },
    }));

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
  });
});
