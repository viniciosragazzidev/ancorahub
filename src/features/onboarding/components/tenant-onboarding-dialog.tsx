"use client"

import { useCallback, useState, useTransition, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { X } from "@/components/huge-icons"

import { Dialog, DialogPopup, DialogClose } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import type { TenantOnboarding } from "../types/onboarding.types"
import { dismissTenantOnboarding } from "../actions/dismiss-tenant-onboarding"
import { OnboardingHero } from "./onboarding-hero"
import { OnboardingBenefits } from "./onboarding-benefits"
import { OnboardingPreview } from "./onboarding-preview"
import { OnboardingStepList } from "./onboarding-step-list"

type TenantOnboardingDialogProps = {
  onboarding: TenantOnboarding
}

function TenantOnboardingDialogInner({ onboarding }: TenantOnboardingDialogProps) {
  const searchParams = useSearchParams()
  const hasForceOpen = searchParams.get("onboarding") === "1"
  const [open, setOpen] = useState(onboarding.shouldAutoOpen || hasForceOpen)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const handleDismiss = useCallback(async () => {
    setOpen(false)

    startTransition(async () => {
      const result = await dismissTenantOnboarding()
      if (!result.success) {
        toast.error(result.error ?? "Erro ao dispensar onboarding.")
        setOpen(true)
      }
    })

    // Remove the onboarding query param if present
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("onboarding") === "1") {
      params.delete("onboarding")
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      window.history.replaceState(null, "", newUrl)
    }
  }, [searchParams])

  const handleNavigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      handleDismiss()
    } else {
      setOpen(true)
    }
  }, [handleDismiss])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        className="flex w-[calc(100vw-24px)] max-w-[1000px] flex-col gap-0 p-0 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:translate-y-3 data-starting-style:translate-y-3 data-ending-style:scale-[0.98]"
      >
        <DialogClose
          aria-label="Fechar onboarding"
          className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" weight="bold" />
        </DialogClose>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain">
          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
            <OnboardingHero
              steps={onboarding.steps}
              onDismiss={handleDismiss}
              onNavigate={handleNavigate}
            />
            <OnboardingBenefits />
          </div>

          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <OnboardingPreview />
          </div>

          <Separator />

          <div className="p-5 sm:p-6">
            <OnboardingStepList
              steps={onboarding.steps}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

export function TenantOnboardingDialog({ onboarding }: TenantOnboardingDialogProps) {
  return (
    <Suspense fallback={null}>
      <TenantOnboardingDialogInner onboarding={onboarding} />
    </Suspense>
  )
}
