import { describe, expect, it } from "vitest";

import {
  getColdLeadReactivationAt,
  getColdLeadReactivationRuleDefaults,
  getColdLeadInboundAction,
  isEligibleColdLeadForReactivation,
} from "./cold-lead-reactivation-policy";

describe("cold lead reactivation policy", () => {
  it("only reactivates completed cold leads still waiting for distribution", () => {
    const eligible = {
      qualificationStatus: "cold",
      qualificationState: "QUALIFIED",
      qualificationCompletedAt: new Date("2026-09-29T12:00:00.000Z"),
      corretorId: null,
      status: "new",
      distributionStatus: "queued",
      distributionRemovedAt: null,
      archivedAt: null,
      deletedAt: null,
    };

    expect(isEligibleColdLeadForReactivation(eligible)).toBe(true);
    expect(isEligibleColdLeadForReactivation({ ...eligible, corretorId: "broker-1" })).toBe(false);
    expect(isEligibleColdLeadForReactivation({ ...eligible, status: "under_analysis" })).toBe(false);
    expect(isEligibleColdLeadForReactivation({ ...eligible, qualificationStatus: "disqualified" })).toBe(false);
    expect(isEligibleColdLeadForReactivation({ ...eligible, distributionRemovedAt: new Date() })).toBe(false);
  });

  it("waits two hours and keeps dispatch inside weekday business hours in Sao Paulo", () => {
    // Tuesday 09:00 local + two hours = 11:00 local.
    expect(getColdLeadReactivationAt(new Date("2026-09-29T12:00:00.000Z"), new Date("2026-09-29T13:30:00.000Z")))
      .toEqual(new Date("2026-09-29T14:00:00.000Z"));
    // Friday 17:30 local + two hours is outside the window; next weekday is Monday 08:00.
    expect(getColdLeadReactivationAt(new Date("2026-10-02T20:30:00.000Z"), new Date("2026-10-02T23:00:00.000Z")))
      .toEqual(new Date("2026-10-05T11:00:00.000Z"));
  });

  it("defaults to one approved-template attempt after two hours", () => {
    expect(getColdLeadReactivationRuleDefaults()).toMatchObject({
      enabled: true,
      delayMinutes: 120,
      maxAttempts: 1,
      allowedDays: [1, 2, 3, 4, 5],
      allowedStartTime: "08:00",
      allowedEndTime: "18:00",
      timezone: "America/Sao_Paulo",
      messageMode: "template",
      templateId: undefined,
    });
  });

  it("resumes qualification only while unassigned and acknowledges only an assigned broker", () => {
    const cold = { qualificationStatus: "cold", featureEnabled: true, optedOut: false };
    expect(getColdLeadInboundAction({ ...cold, corretorRole: null })).toBe("resume_qualification");
    expect(getColdLeadInboundAction({ ...cold, corretorRole: "broker" })).toBe("acknowledge_broker");
    expect(getColdLeadInboundAction({ ...cold, corretorRole: "director" })).toBe("ignore");
    expect(getColdLeadInboundAction({ ...cold, corretorRole: "broker", optedOut: true })).toBe("ignore");
    expect(getColdLeadInboundAction({ ...cold, corretorRole: null, featureEnabled: false })).toBe("ignore");
  });
});
