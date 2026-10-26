import { describe, expect, it } from "vitest";
import { QUALIFICATION_TIMEOUT_SKIPPED_STATUSES, runQualificationTimeoutSweep } from "./qualification-timeout-sweep";

describe("Qualification Timeout SLA Sweep (Max 20 Min Rule)", () => {
  it("runs qualification timeout sweep without throwing in test environment", async () => {
    const result = await runQualificationTimeoutSweep("non_existent_tenant");
    expect(result).toBeDefined();
    expect(result.tenantsChecked).toBe(0);
    expect(result.timedOutLeads).toBe(0);
    expect(result.distributedLeads).toBe(0);
  });

  it("still closes a hot lead whose conversation stopped before the last answer", () => {
    expect(QUALIFICATION_TIMEOUT_SKIPPED_STATUSES).not.toContain("hot");
    expect(QUALIFICATION_TIMEOUT_SKIPPED_STATUSES).toContain("warm");
  });
});
