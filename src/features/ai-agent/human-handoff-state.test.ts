import { describe, expect, it } from "vitest";

import { buildHumanHandoffLeadUpdate } from "./human-handoff-state";

describe("buildHumanHandoffLeadUpdate", () => {
  it("makes a human handoff eligible for immediate automatic distribution", () => {
    const at = new Date("2026-09-03T14:00:00.000Z");

    expect(buildHumanHandoffLeadUpdate(at)).toEqual({
      qualificationStatus: "waiting_human",
      qualificationState: "QUALIFIED",
      qualificationCompletedAt: at,
      status: "new",
      distributionStatus: "queued",
      distributionUpdatedAt: at,
      updatedAt: at,
    });
  });
});
