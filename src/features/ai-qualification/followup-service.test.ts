import { describe, expect, it } from "vitest";

import { followUpRuleSchema, isFollowUpExecutionAllowed } from "./followup-service";
import { getColdLeadReactivationRuleDefaults } from "./cold-lead-reactivation-policy";

describe("follow-up execution policy", () => {
  it("keeps generic draft rules inactive", () => {
    const rule = followUpRuleSchema.parse({
      name: "Retomar qualificação",
      enabled: true,
      trigger: "qualification_abandoned",
    });

    expect(rule.enabled).toBe(true);
    expect(isFollowUpExecutionAllowed(rule.trigger, rule.enabled)).toBe(false);
  });

  it("defaults the cold lead rule to one active, fixed-window attempt", () => {
    const rule = getColdLeadReactivationRuleDefaults();

    expect(isFollowUpExecutionAllowed(rule.trigger, rule.enabled)).toBe(true);
    expect(rule.maxAttempts).toBe(1);
    expect(rule.delayMinutes).toBe(120);
  });

  it("defaults generic rules to a non-active draft", () => {
    const rule = followUpRuleSchema.parse({
      name: "Retomar qualificação",
      trigger: "qualification_abandoned",
    });

    expect(rule.enabled).toBe(false);
  });
});
