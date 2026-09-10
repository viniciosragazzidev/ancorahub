import { describe, expect, it } from "vitest";

import { selectBulkDistributionCandidateIds } from "./bulk-recovery";

describe("bulk distribution recovery", () => {
  it("re-enqueues every operational lead that is ready and still has no broker", () => {
    expect(selectBulkDistributionCandidateIds([
      { id: "queued", status: "new", distributionStatus: "queued", qualificationState: "COMPLETED", qualificationStatus: "qualified" },
      { id: "unassigned", status: "new", distributionStatus: "unassigned", qualificationState: "QUALIFIED", qualificationStatus: "cold" },
      { id: "returned", status: "new", distributionStatus: "returned_to_queue", qualificationState: null, qualificationStatus: null },
    ])).toEqual(["queued", "unassigned", "returned"]);
  });

  it("does not distribute leads that are qualifying, terminal, or already outside the recovery queue", () => {
    expect(selectBulkDistributionCandidateIds([
      { id: "qualifying", status: "new", distributionStatus: "queued", qualificationState: "IN_PROGRESS", qualificationStatus: "qualifying" },
      { id: "lost", status: "lost", distributionStatus: "unassigned", qualificationState: "COMPLETED", qualificationStatus: "qualified" },
      { id: "disqualified", status: "new", distributionStatus: "unassigned", qualificationState: "COMPLETED", qualificationStatus: "disqualified" },
      { id: "assigned", status: "distributed", distributionStatus: "assigned", qualificationState: "COMPLETED", qualificationStatus: "qualified" },
    ])).toEqual([]);
  });
});
