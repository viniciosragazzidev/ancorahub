export const ONBOARDING_STEP_IDS = [
  "create-branch",
  "invite-team",
  "configure-catalog",
  "customize-brand",
  "define-goals",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStepStatus = "completed" | "pending" | "unavailable";

export type TenantOnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  href: string | null;
  actionLabel: string | null;
  essential: boolean;
};

export type OnboardingProgress = {
  totalSteps: number;
  availableSteps: number;
  completedSteps: number;
  progressPercentage: number;
  essentialCompleted: boolean;
  fullyCompleted: boolean;
};

export type TenantOnboarding = {
  tenantName: string;
  userName: string;
  dismissed: boolean;
  shouldAutoOpen: boolean;
  steps: TenantOnboardingStep[];
  totalSteps: number;
  availableSteps: number;
  completedSteps: number;
  progressPercentage: number;
  essentialCompleted: boolean;
  fullyCompleted: boolean;
};
