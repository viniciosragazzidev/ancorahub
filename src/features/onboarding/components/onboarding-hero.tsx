"use client"

import { CorreTopLogo } from "@/components/corretop-logo"
import { ArrowRight, Compass } from "@/components/huge-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TenantOnboardingStep } from "../types/onboarding.types"
import { getFirstPendingStep } from "../services/get-first-pending-step"

type OnboardingHeroProps = {
  steps: TenantOnboardingStep[]
  onDismiss: () => void
  onNavigate: (href: string) => void
}

export function OnboardingHero({ steps, onDismiss, onNavigate }: OnboardingHeroProps) {
  const firstPending = getFirstPendingStep(steps)

  function handlePrimaryAction() {
    if (firstPending?.href) {
      onNavigate(firstPending.href)
    }
  }

  const hasPendingSteps = steps.some(
    (s) => s.status === "pending" && s.href !== null,
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <CorreTopLogo className="h-7 w-28 object-contain object-left" />
        <Badge variant="outline" className="ml-auto text-[10px]">
          Configuração inicial
        </Badge>
      </div>

      <h1 className="mt-2 max-w-[22ch] text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Prepare sua corretora para começar
      </h1>

      <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
        Configure a estrutura inicial do tenant, organize sua equipe e deixe o
        ambiente pronto para operar.
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        {hasPendingSteps && firstPending && (
          <Button
            size="lg"
            className="w-full whitespace-normal sm:w-auto"
            onClick={handlePrimaryAction}
          >
            <span>Continuar configuração</span>
            <ArrowRight weight="bold" className="size-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="w-full whitespace-normal sm:w-auto"
          onClick={onDismiss}
        >
          <Compass className="size-4" />
          <span>Explorar o sistema</span>
        </Button>
      </div>
    </div>
  )
}
