import { describe, expect, it } from "vitest";

import { resolveTenantGlobalPlanVisibility } from "./availability";

describe("resolveTenantGlobalPlanVisibility", () => {
  const plans = [
    { planId: "global-plan-a", carrierName: "Operadora A" },
    { planId: "global-plan-b", carrierName: "Operadora B" },
  ];

  it("keeps a published global plan visible when the tenant has no override", () => {
    expect(resolveTenantGlobalPlanVisibility(plans, [])).toEqual(plans);
  });

  it("honors an explicit tenant hide without affecting the other global plans", () => {
    expect(resolveTenantGlobalPlanVisibility(plans, [
      { globalPlanId: "global-plan-a", enabled: false },
      { globalPlanId: "global-plan-b", enabled: true },
    ])).toEqual([{ planId: "global-plan-b", carrierName: "Operadora B" }]);
  });
  it("preserves tenant hides when branch restrictions are applied", () => {
    expect(resolveTenantGlobalPlanVisibility(plans, [{ globalPlanId: "global-plan-a", enabled: false }], new Set())).toEqual([plans[1]]);
    expect(resolveTenantGlobalPlanVisibility(plans, [{ globalPlanId: "global-plan-a", enabled: false }], new Set(["global-plan-b"]))).toEqual([]);
    expect(resolveTenantGlobalPlanVisibility(plans, [{ globalPlanId: "global-plan-a", enabled: true }], new Set(["global-plan-a"]))).toEqual([plans[1]]);
  });
});
