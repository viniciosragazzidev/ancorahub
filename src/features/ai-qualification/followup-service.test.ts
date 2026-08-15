import { describe, expect, it } from "vitest";

import { followUpRuleSchema, isFollowUpExecutionAllowed } from "./followup-service";

describe("follow-up preparation policy", () => {
  it("keeps outbound execution disabled even when a draft rule asks to be enabled", () => {
    const rule = followUpRuleSchema.parse({
      name: "Retomar qualificação",
      enabled: true,
      trigger: "qualification_abandoned",
    });

    expect(rule.enabled).toBe(true);
    expect(isFollowUpExecutionAllowed()).toBe(false);
  });

  it("defaults a new rule to a non-active draft", () => {
    const rule = followUpRuleSchema.parse({
      name: "Retomar qualificação",
      trigger: "qualification_abandoned",
    });

    expect(rule.enabled).toBe(false);
  });
});
