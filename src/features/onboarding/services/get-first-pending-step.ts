import type { TenantOnboardingStep } from "../types/onboarding.types";

export function getFirstPendingStep(
  steps: TenantOnboardingStep[],
): TenantOnboardingStep | null {
  return (
    steps.find(
      (step) =>
        step.status === "pending" &&
        step.href !== null,
    ) ?? null
  );
}
