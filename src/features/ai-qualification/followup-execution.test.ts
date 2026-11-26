import { describe, expect, it } from "vitest";

import { followUpInertBadge, isFollowUpExecutionAllowed } from "./followup-execution";

describe("selo Não dispara ainda", () => {
  it("só a reativação de lead frio ligada dispara", () => {
    expect(isFollowUpExecutionAllowed("cold_lead_reactivation", true)).toBe(true);
    expect(followUpInertBadge({ trigger: "cold_lead_reactivation", enabled: true })).toBeNull();
  });

  it("regra genérica, mesmo ligada, ganha o selo", () => {
    expect(followUpInertBadge({ trigger: "qualification_abandoned", enabled: true })).toBe("Não dispara ainda");
    expect(followUpInertBadge({ trigger: "no_first_response", enabled: false })).toBe("Não dispara ainda");
  });

  it("reativação desligada também não dispara", () => {
    expect(followUpInertBadge({ trigger: "cold_lead_reactivation", enabled: false })).toBe("Não dispara ainda");
  });
});
