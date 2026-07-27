import type { TenantOnboardingStep, OnboardingProgress } from "../types/onboarding.types";

export function calculateOnboardingProgress(
  steps: TenantOnboardingStep[],
): OnboardingProgress {
  const availableSteps = steps.filter(
    (step) => step.status !== "unavailable",
  );

  const completedSteps = availableSteps.filter(
    (step) => step.status === "completed",
  );

  const essentialSteps = steps.filter(
    (step) => step.essential,
  );

  return {
    totalSteps: steps.length,
    availableSteps: availableSteps.length,
    completedSteps: completedSteps.length,
    progressPercentage:
      availableSteps.length === 0
        ? 0
        : Math.round(
            (completedSteps.length / availableSteps.length) * 100,
          ),
    essentialCompleted: essentialSteps.every(
      (step) => step.status === "completed",
    ),
    fullyCompleted:
      availableSteps.length > 0 &&
      completedSteps.length === availableSteps.length,
  };
}
