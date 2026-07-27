"use client"

import { CheckCircle, Circle } from "@/components/huge-icons"
import { cn } from "@/lib/utils"
import type { TenantOnboardingStep } from "../types/onboarding.types"

type OnboardingStepItemProps = {
  step: TenantOnboardingStep
  onNavigate: (href: string) => void
}

export function OnboardingStepItem({ step, onNavigate }: OnboardingStepItemProps) {
  const isCompleted = step.status === "completed"
  const isPending = step.status === "pending"
  const isUnavailable = step.status === "unavailable"

  function handleAction() {
    if (step.href) {
      onNavigate(step.href)
    }
  }

  const statusLabel = isCompleted
    ? "Concluído"
    : isUnavailable
      ? "Disponível em breve"
      : "Pendente"

  const statusColor = isCompleted
    ? "text-success"
    : isUnavailable
      ? "text-muted-foreground/40"
      : "text-warning"

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg border p-4 transition-all duration-200",
        isCompleted && "border-success/20 bg-success/10",
        isPending && "border-border bg-card hover:border-ct-blue/30 hover:bg-accent/30",
        isUnavailable && "border-dashed border-border/40 bg-muted/20 opacity-60",
      )}
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {isCompleted ? (
          <CheckCircle
            weight="fill"
            className="size-5 text-success transition-all duration-300"
          />
        ) : isPending ? (
          <Circle className="size-5 text-muted-foreground/40" weight="regular" />
        ) : (
          <Circle className="size-5 text-muted-foreground/20" weight="regular" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-base font-medium leading-snug",
              isUnavailable && "text-muted-foreground/50",
            )}
          >
            {step.title}
          </span>
          {step.essential && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Essencial
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-1 text-sm leading-relaxed",
            isUnavailable ? "text-muted-foreground/40" : "text-muted-foreground",
          )}
        >
          {step.description}
        </p>
      </div>

      {/* Status + Action */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={cn("text-sm font-medium", statusColor)}>
          {statusLabel}
        </span>
        {isPending && step.actionLabel && step.href && (
          <button
            type="button"
            onClick={handleAction}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {step.actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
