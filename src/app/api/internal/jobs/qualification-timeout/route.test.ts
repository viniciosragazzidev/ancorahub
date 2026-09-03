import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runQualificationTimeoutSweep, runSlaSweep } = vi.hoisted(() => ({
  runQualificationTimeoutSweep: vi.fn(),
  runSlaSweep: vi.fn(),
}));

vi.mock("@/features/ai-agent/qualification-timeout-sweep", () => ({
  runQualificationTimeoutSweep,
}));

vi.mock("@/features/leads/sla", () => ({
  runSlaSweep,
}));

import { GET } from "./route";

describe("qualification timeout internal job", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });

  it("rejects requests without the internal scheduler credential", async () => {
    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout"));

    expect(response.status).toBe(401);
    expect(runQualificationTimeoutSweep).not.toHaveBeenCalled();
  });

  it("runs the timeout sweep only after scheduler authentication", async () => {
    runQualificationTimeoutSweep.mockResolvedValue({ tenantsChecked: 1, timedOutLeads: 2, distributedLeads: 2 });
    runSlaSweep.mockResolvedValue({ tenants: 1, unworked: 0, warnings: 0, stalled: 0, notifications: 0 });

    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      result: { tenantsChecked: 1, timedOutLeads: 2, distributedLeads: 2 },
      slaResult: { tenants: 1, unworked: 0, warnings: 0, stalled: 0, notifications: 0 },
    });
  });
});
