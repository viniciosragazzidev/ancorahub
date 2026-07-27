export type TenantGlobalPlanAvailabilityOverride = {
  globalPlanId: string;
  enabled: boolean;
};

/**
 * Published global plans are available platform-wide by default. A tenant
 * setting exists only when the Super-admin needs to explicitly hide or
 * restore a plan for that brokerage.
 */
export function resolveTenantGlobalPlanVisibility<T extends { planId: string }>(
  plans: readonly T[],
  overrides: readonly TenantGlobalPlanAvailabilityOverride[],
): T[] {
  const hiddenPlanIds = new Set(
    overrides.filter((override) => !override.enabled).map((override) => override.globalPlanId),
  );

  return plans.filter((plan) => !hiddenPlanIds.has(plan.planId));
}
