import { describe, expect, it } from "vitest";

import { summarizeFollowupStats, type FollowupStatRow } from "./followup-stats-core";

const row = (partial: Partial<FollowupStatRow>): FollowupStatRow => ({
  sent: 1, skipped: 0, stopReason: null, cadenceActive: false, replied: false, qualificationStatus: "pending", status: "new", ...partial,
});

describe("summarizeFollowupStats", () => {
  it("is zero without follow-ups", () => {
    expect(summarizeFollowupStats([])).toEqual({ scheduled: 0, sent: 0, responded: 0, interrupted: 0, conversionsPostFollowup: 0, costPerRecoveryBrl: 0 });
  });

  it("counts sends, replies, recoveries and interruptions", () => {
    const stats = summarizeFollowupStats([
      row({ sent: 2, replied: true, qualificationStatus: "hot" }),
      row({ sent: 1, replied: true, qualificationStatus: "qualifying" }),
      row({ sent: 1, replied: true, status: "quote_sent" }),
      row({ sent: 0, skipped: 3, cadenceActive: true }),
      row({ sent: 1, stopReason: "opt_out" }),
    ]);
    expect(stats.sent).toBe(5);
    expect(stats.responded).toBe(3);
    expect(stats.conversionsPostFollowup).toBe(2);
    expect(stats.scheduled).toBe(1);
    expect(stats.interrupted).toBe(1);
    expect(stats.costPerRecoveryBrl).toBe(0.09);
  });

  it("never counts a reply from a lead that got only skipped touches", () => {
    expect(summarizeFollowupStats([row({ sent: 0, skipped: 2, replied: true, qualificationStatus: "hot" })]).conversionsPostFollowup).toBe(0);
  });
});
