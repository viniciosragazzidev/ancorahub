import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runQualificationTimeoutSweep, runSlaSweep, attendanceFlowsEnabled, wakeDueRuns } = vi.hoisted(() => ({
  runQualificationTimeoutSweep: vi.fn(),
  runSlaSweep: vi.fn(),
  attendanceFlowsEnabled: vi.fn(),
  wakeDueRuns: vi.fn(),
}));

// DEC-127: the job also wakes attendance flow runs whose wait is over.
vi.mock("@/features/attendance-flows/runtime", () => ({ attendanceFlowsEnabled, wakeDueRuns }));
vi.mock("@/features/attendance-flows/handlers", () => ({ flowEffectHandlers: () => ({}) }));

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
    attendanceFlowsEnabled.mockResolvedValue(true);
    wakeDueRuns.mockResolvedValue(3);

    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      result: { tenantsChecked: 1, timedOutLeads: 2, distributedLeads: 2 },
      slaResult: { tenants: 1, unworked: 0, warnings: 0, stalled: 0, notifications: 0 },
      attendanceRuns: 3,
    });
  });

  it("does not wake attendance flows while their switch is off", async () => {
    runQualificationTimeoutSweep.mockResolvedValue({ tenantsChecked: 0, timedOutLeads: 0, distributedLeads: 0 });
    runSlaSweep.mockResolvedValue({ tenants: 0, unworked: 0, warnings: 0, stalled: 0, notifications: 0 });
    attendanceFlowsEnabled.mockResolvedValue(false);

    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect((await response.json()).attendanceRuns).toBe(0);
    expect(wakeDueRuns).not.toHaveBeenCalled();
  });
});
