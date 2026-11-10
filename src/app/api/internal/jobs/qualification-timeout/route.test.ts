import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runQualificationTimeoutSweep, runUnansweredInboundRecovery, runSilenceFollowUpSweep, runSlaSweep, runColdLeadRequalificationSweep, attendanceFlowsEnabled, wakeDueRuns } = vi.hoisted(() => ({
  runQualificationTimeoutSweep: vi.fn(),
  runUnansweredInboundRecovery: vi.fn(),
  runSilenceFollowUpSweep: vi.fn(),
  runSlaSweep: vi.fn(),
  runColdLeadRequalificationSweep: vi.fn(),
  attendanceFlowsEnabled: vi.fn(),
  wakeDueRuns: vi.fn(),
}));

// DEC-127: the job also wakes attendance flow runs whose wait is over.
vi.mock("@/features/attendance-flows/runtime", () => ({ attendanceFlowsEnabled, wakeDueRuns }));
vi.mock("@/features/attendance-flows/handlers", () => ({ flowEffectHandlers: () => ({}) }));

vi.mock("@/features/ai-agent/qualification-timeout-sweep", () => ({
  runQualificationTimeoutSweep,
}));
vi.mock("@/features/ai-agent/unanswered-recovery", () => ({ runUnansweredInboundRecovery }));
vi.mock("@/features/ai-agent/silence-follow-up", () => ({ runSilenceFollowUpSweep }));

vi.mock("@/features/leads/sla", () => ({
  runSlaSweep,
}));
vi.mock("@/features/ai-qualification/cold-lead-requalification", () => ({ runColdLeadRequalificationSweep }));

import { GET, maxDuration } from "./route";

describe("qualification timeout internal job", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    runUnansweredInboundRecovery.mockResolvedValue({ candidates: 0, answered: 0 });
    runSilenceFollowUpSweep.mockResolvedValue({ candidates: 0, sent: 0, failed: 0, skipped: {} });
  });

  it("rejects requests without the internal scheduler credential", async () => {
    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout"));

    expect(response.status).toBe(401);
    expect(runQualificationTimeoutSweep).not.toHaveBeenCalled();
  });

  it("runs the timeout sweep only after scheduler authentication", async () => {
    const order: string[] = [];
    runQualificationTimeoutSweep.mockImplementation(async () => {
      order.push("timeout");
      return { tenantsChecked: 1, timedOutLeads: 2, distributedLeads: 2 };
    });
    runUnansweredInboundRecovery.mockImplementation(async () => {
      order.push("recovery");
      return { candidates: 1, answered: 1 };
    });
    runSilenceFollowUpSweep.mockImplementation(async () => {
      order.push("silence-follow-up");
      return { candidates: 2, sent: 1, failed: 0, skipped: { customer_replied: 1 } };
    });
    runSlaSweep.mockResolvedValue({ tenants: 1, unworked: 0, warnings: 0, stalled: 0, notifications: 0 });
    runColdLeadRequalificationSweep.mockResolvedValue({ tenantsChecked: 1, candidates: 1, queued: 1, sent: 0, blocked: 0 });
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
      coldLeadRequalification: { tenantsChecked: 1, candidates: 1, queued: 1, sent: 0, blocked: 0 },
      unansweredRecovery: { candidates: 1, answered: 1 },
      silenceFollowUp: { candidates: 2, sent: 1, failed: 0, skipped: { customer_replied: 1 } },
    });
    expect(order).toEqual(["timeout", "recovery", "silence-follow-up"]);
    expect(runUnansweredInboundRecovery).toHaveBeenCalledWith({ deadlineAt: expect.any(Number) });
    expect(runSilenceFollowUpSweep).toHaveBeenCalledWith({ deadlineAt: expect.any(Number) });
    expect(maxDuration).toBe(60);
  });

  it("does not wake attendance flows while their switch is off", async () => {
    runQualificationTimeoutSweep.mockResolvedValue({ tenantsChecked: 0, timedOutLeads: 0, distributedLeads: 0 });
    runSlaSweep.mockResolvedValue({ tenants: 0, unworked: 0, warnings: 0, stalled: 0, notifications: 0 });
    runColdLeadRequalificationSweep.mockResolvedValue({ tenantsChecked: 0, candidates: 0, queued: 0, sent: 0, blocked: 0 });
    attendanceFlowsEnabled.mockResolvedValue(false);

    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect((await response.json()).attendanceRuns).toBe(0);
    expect(wakeDueRuns).not.toHaveBeenCalled();
  });

  it("keeps the job running when the silence follow-up fails", async () => {
    runQualificationTimeoutSweep.mockResolvedValue({ tenantsChecked: 0, timedOutLeads: 0, distributedLeads: 0 });
    runSlaSweep.mockResolvedValue({ tenants: 0, unworked: 0, warnings: 0, stalled: 0, notifications: 0 });
    runColdLeadRequalificationSweep.mockResolvedValue({ tenantsChecked: 0, candidates: 0, queued: 0, sent: 0, blocked: 0 });
    attendanceFlowsEnabled.mockResolvedValue(false);
    runSilenceFollowUpSweep.mockRejectedValue(new Error("db down"));

    const response = await GET(new NextRequest("http://localhost/api/internal/jobs/qualification-timeout", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).silenceFollowUp).toBeNull();
  });
});
