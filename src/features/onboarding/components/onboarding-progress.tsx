import { Progress } from "@/components/ui/progress"

type OnboardingProgressProps = {
  completedSteps: number
  availableSteps: number
  progressPercentage: number
}

export function OnboardingProgressBar({
  completedSteps,
  availableSteps,
  progressPercentage,
}: OnboardingProgressProps) {
  if (availableSteps === 0) return null

  return (
    <div className="flex items-center gap-3">
      <Progress
        value={progressPercentage}
        className="h-2 flex-1"
        aria-label={`${completedSteps} de ${availableSteps} etapas concluídas`}
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {completedSteps} de {availableSteps}
      </span>
    </div>
  )
}
