import { describe, expect, it } from "vitest";
import { isHeldByRunningQualification } from "./domain";
import { selectBulkDistributionCandidateIds } from "./bulk-recovery";

describe("hot lead early distribution (DEC-153)", () => {
  it("does not hold a hot lead the AI is still qualifying", () => {
    expect(isHeldByRunningQualification("hot", "IN_PROGRESS", true)).toBe(false);
  });

  it("still holds the others while the AI qualifies", () => {
    expect(isHeldByRunningQualification("qualifying", "IN_PROGRESS", true)).toBe(true);
    expect(isHeldByRunningQualification("warm", "IN_PROGRESS", true)).toBe(true);
    expect(isHeldByRunningQualification("warm", "QUALIFIED", true)).toBe(false);
  });

  it("holds the hot one too with the flag off", () => {
    expect(isHeldByRunningQualification("hot", "IN_PROGRESS", false)).toBe(true);
  });

  it("bulk recovery takes the hot lead in qualification", () => {
    const lead = { id: "l1", status: "new", distributionStatus: "unassigned", qualificationState: "IN_PROGRESS", qualificationStatus: "hot" };
    expect(selectBulkDistributionCandidateIds([lead])).toEqual(["l1"]);
    expect(selectBulkDistributionCandidateIds([lead], false)).toEqual([]);
  });
});
