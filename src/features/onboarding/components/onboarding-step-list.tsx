import type { TenantOnboardingStep } from "../types/onboarding.types"
import { OnboardingStepItem } from "./onboarding-step-item"
import { OnboardingProgressBar } from "./onboarding-progress"
import { calculateOnboardingProgress } from "../services/calculate-onboarding-progress"

type OnboardingStepListProps = {
  steps: TenantOnboardingStep[]
  onNavigate: (href: string) => void
}

export function OnboardingStepList({ steps, onNavigate }: OnboardingStepListProps) {
  const progress = calculateOnboardingProgress(steps)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Checklist de configuração</h3>
        <span className="text-sm text-muted-foreground">
          {progress.completedSteps} de {progress.availableSteps} etapas disponíveis concluídas
        </span>
      </div>

      <OnboardingProgressBar
        completedSteps={progress.completedSteps}
        availableSteps={progress.availableSteps}
        progressPercentage={progress.progressPercentage}
      />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <OnboardingStepItem
            key={step.id}
            step={step}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}
