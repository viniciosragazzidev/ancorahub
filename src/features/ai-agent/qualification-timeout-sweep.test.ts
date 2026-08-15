import { describe, expect, it } from "vitest";
import { runQualificationTimeoutSweep } from "./qualification-timeout-sweep";

describe("Qualification Timeout SLA Sweep (Max 20 Min Rule)", () => {
  it("runs qualification timeout sweep without throwing in test environment", async () => {
    const result = await runQualificationTimeoutSweep("non_existent_tenant");
    expect(result).toBeDefined();
    expect(result.tenantsChecked).toBe(0);
    expect(result.timedOutLeads).toBe(0);
    expect(result.distributedLeads).toBe(0);
  });
});
