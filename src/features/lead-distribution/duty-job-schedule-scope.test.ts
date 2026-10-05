import { describe, expect, it } from "vitest";
import { isDutyScheduleBranchCompatible } from "./duty-job-schedule-scope";

describe("active duty job schedule branch scope", () => {
  it("matches a global schedule to leads with a unit", () => {
    expect(isDutyScheduleBranchCompatible(null, "branch-a")).toBe(true);
  });

  it("keeps unit schedules scoped while allowing branchless leads", () => {
    expect(isDutyScheduleBranchCompatible("branch-a", "branch-a")).toBe(true);
    expect(isDutyScheduleBranchCompatible("branch-a", null)).toBe(true);
    expect(isDutyScheduleBranchCompatible("branch-a", "branch-b")).toBe(false);
  });
});
