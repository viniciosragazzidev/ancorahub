import { describe, expect, it } from "vitest";

import { buildDeclinedLeadReleaseUpdate } from "./decline-policy";

describe("declined lead release policy", () => {
  it("removes the provisional broker before redistributing the lead", () => {
    const now = new Date("2026-09-15T18:00:00.000Z");

    expect(buildDeclinedLeadReleaseUpdate(now)).toMatchObject({
      corretorId: null,
      distributionStatus: "queued",
      assignmentSource: "redistribution",
      assignedAt: null,
      distributionUpdatedAt: now,
    });
  });
});
