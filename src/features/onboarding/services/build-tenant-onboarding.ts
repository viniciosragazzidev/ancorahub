import "server-only";

import type { TenantOnboarding, TenantOnboardingStep } from "../types/onboarding.types";
import { calculateOnboardingProgress } from "./calculate-onboarding-progress";
import { getFirstPendingStep } from "./get-first-pending-step";

export type OnboardingData = {
  tenantName: string;
  userName: string;
  hasBranches: boolean;
  hasActiveMembers: boolean;
  hasPendingInvites: boolean;
  hasCatalogItems: boolean;
  hasBranding: boolean;
  hasActiveGoals: boolean;
  onboardingDismissedAt: Date | null;
};

export function buildTenantOnboarding(data: OnboardingData): TenantOnboarding {
  const steps: TenantOnboardingStep[] = [
    {
      id: "create-branch",
      title: "Criar filial",
      description: "Estruture as unidades da corretora.",
      status: data.hasBranches ? "completed" : "pending",
      href: "#branches",
      actionLabel: "Configurar",
      essential: true,
    },
    {
      id: "invite-team",
      title: "Convidar equipe",
      description: "Adicione gestores e corretores ao time.",
      status: data.hasActiveMembers || data.hasPendingInvites ? "completed" : "pending",
      href: "/equipe",
      actionLabel: "Convidar",
      essential: true,
    },
    {
      id: "configure-catalog",
      title: "Configurar catálogo",
      description: "Defina operadoras e planos disponíveis.",
      status: data.hasCatalogItems ? "completed" : "unavailable",
      href: "#catalog",
      actionLabel: "Configurar",
      essential: false,
    },
    {
      id: "customize-brand",
      title: "Personalizar marca",
      description: "Adicione logo e identidade visual.",
      status: data.hasBranding ? "completed" : "unavailable",
      href: null,
      actionLabel: null,
      essential: false,
    },
    {
      id: "define-goals",
      title: "Definir metas",
      description: "Estabeleça metas comerciais para a equipe.",
      status: data.hasActiveGoals ? "completed" : "unavailable",
      href: "#goals",
      actionLabel: "Definir",
      essential: false,
    },
  ];

  const progress = calculateOnboardingProgress(steps);
  const firstPending = getFirstPendingStep(steps);

  return {
    tenantName: data.tenantName,
    userName: data.userName,
    dismissed: data.onboardingDismissedAt !== null,
    shouldAutoOpen:
      data.onboardingDismissedAt === null &&
      !progress.fullyCompleted &&
      firstPending !== null,
    steps,
    ...progress,
  };
}
