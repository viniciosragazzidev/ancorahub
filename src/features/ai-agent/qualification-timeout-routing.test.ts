import { describe, expect, it } from "vitest";

import { resolveQualificationTimeoutRoute } from "./qualification-timeout-routing";

describe("resolveQualificationTimeoutRoute", () => {
  it("keeps the active campaign/type queue authoritative after the qualification timeout", () => {
    expect(resolveQualificationTimeoutRoute({
      currentQueueId: "old-queue",
      currentBranchId: "old-branch",
      configuredRoute: { queueId: "campaign-queue", branchId: "campaign-branch" },
    })).toEqual({ queueId: "campaign-queue", branchId: "campaign-branch" });
  });

  it("preserves the intake queue when no campaign/type route is configured", () => {
    expect(resolveQualificationTimeoutRoute({
      currentQueueId: "intake-queue",
      currentBranchId: "intake-branch",
    })).toEqual({ queueId: "intake-queue", branchId: "intake-branch" });
  });
});
