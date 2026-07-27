import { describe, it, expect } from "vitest";
import { calculateOnboardingProgress } from "../services/calculate-onboarding-progress";
import { getFirstPendingStep } from "../services/get-first-pending-step";
import { buildTenantOnboarding, type OnboardingData } from "../services/build-tenant-onboarding";
import type { TenantOnboardingStep } from "../types/onboarding.types";

// ─── calculateOnboardingProgress ──────────────────────────────────────

describe("calculateOnboardingProgress", () => {
  it("returns zero progress when no steps are completed", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "pending", href: "/branches", actionLabel: "Configurar", essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "pending", href: "/equipe", actionLabel: "Convidar", essential: true },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.completedSteps).toBe(0);
    expect(result.availableSteps).toBe(2);
    expect(result.progressPercentage).toBe(0);
    expect(result.essentialCompleted).toBe(false);
    expect(result.fullyCompleted).toBe(false);
  });

  it("calculates 50% when branch step is completed but team is pending", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "pending", href: "/equipe", actionLabel: "Convidar", essential: true },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.completedSteps).toBe(1);
    expect(result.availableSteps).toBe(2);
    expect(result.progressPercentage).toBe(50);
    expect(result.essentialCompleted).toBe(false);
    expect(result.fullyCompleted).toBe(false);
  });

  it("correctly filters unavailable steps from the denominator", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "pending", href: "/equipe", actionLabel: "Convidar", essential: true },
      { id: "configure-catalog", title: "Catálogo", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
      { id: "customize-brand", title: "Marca", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
      { id: "define-goals", title: "Metas", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.totalSteps).toBe(5);
    expect(result.availableSteps).toBe(2);
    expect(result.completedSteps).toBe(1);
    expect(result.progressPercentage).toBe(50);
    expect(result.essentialCompleted).toBe(false);
  });

  it("reports essential completed when all essential steps are done", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "completed", href: "/equipe", actionLabel: null, essential: true },
      { id: "configure-catalog", title: "Catálogo", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.essentialCompleted).toBe(true);
    expect(result.fullyCompleted).toBe(true);
  });

  it("reports fully completed when all available steps are done", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "completed", href: "/equipe", actionLabel: null, essential: true },
      { id: "configure-catalog", title: "Catálogo", description: "", status: "completed", href: "/catalog", actionLabel: null, essential: false },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.fullyCompleted).toBe(true);
    expect(result.progressPercentage).toBe(100);
  });

  it("handles zero available steps gracefully", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "configure-catalog", title: "Catálogo", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
      { id: "customize-brand", title: "Marca", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
    ];

    const result = calculateOnboardingProgress(steps);

    expect(result.availableSteps).toBe(0);
    expect(result.progressPercentage).toBe(0);
    expect(result.fullyCompleted).toBe(false);
  });
});

// ─── getFirstPendingStep ──────────────────────────────────────────────

describe("getFirstPendingStep", () => {
  it("returns the first pending step with an href", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "pending", href: "/equipe", actionLabel: "Convidar", essential: true },
    ];

    expect(getFirstPendingStep(steps)?.id).toBe("invite-team");
  });

  it("returns null when all steps are completed", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
    ];

    expect(getFirstPendingStep(steps)).toBeNull();
  });

  it("returns null when the only pending step has no href", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "customize-brand", title: "Marca", description: "", status: "pending", href: null, actionLabel: null, essential: false },
    ];

    expect(getFirstPendingStep(steps)).toBeNull();
  });

  it("skips unavailable and completed steps to find the first pending", () => {
    const steps: TenantOnboardingStep[] = [
      { id: "create-branch", title: "Criar filial", description: "", status: "completed", href: "/branches", actionLabel: null, essential: true },
      { id: "invite-team", title: "Convidar equipe", description: "", status: "pending", href: "/equipe", actionLabel: "Convidar", essential: true },
      { id: "configure-catalog", title: "Catálogo", description: "", status: "unavailable", href: null, actionLabel: null, essential: false },
    ];

    expect(getFirstPendingStep(steps)?.id).toBe("invite-team");
  });
});

// ─── buildTenantOnboarding ────────────────────────────────────────────

describe("buildTenantOnboarding", () => {
  function makeData(overrides: Partial<OnboardingData> = {}): OnboardingData {
    return {
      tenantName: "Corretora Teste",
      userName: "João Admin",
      hasBranches: false,
      hasActiveMembers: false,
      hasPendingInvites: false,
      hasCatalogItems: false,
      hasBranding: false,
      hasActiveGoals: false,
      onboardingDismissedAt: null,
      ...overrides,
    };
  }

  it("returns a complete TenantOnboarding object with all fields", () => {
    const result = buildTenantOnboarding(makeData());

    expect(result.tenantName).toBe("Corretora Teste");
    expect(result.userName).toBe("João Admin");
    expect(result.dismissed).toBe(false);
    expect(result.shouldAutoOpen).toBe(true);
    expect(result.totalSteps).toBe(5);
    expect(result.availableSteps).toBe(2); // catalog, brand, goals unavailable
    expect(result.steps).toHaveLength(5);
  });

  it("sets dismissed to true when onboardingDismissedAt is provided", () => {
    const result = buildTenantOnboarding(makeData({ onboardingDismissedAt: new Date() }));

    expect(result.dismissed).toBe(true);
    expect(result.shouldAutoOpen).toBe(false);
  });

  it("marks create-branch as completed when hasBranches is true", () => {
    const result = buildTenantOnboarding(makeData({ hasBranches: true }));

    expect(result.steps.find((s) => s.id === "create-branch")?.status).toBe("completed");
  });

  it("marks invite-team as completed when hasActiveMembers is true", () => {
    const result = buildTenantOnboarding(makeData({ hasActiveMembers: true }));

    expect(result.steps.find((s) => s.id === "invite-team")?.status).toBe("completed");
  });

  it("marks invite-team as completed when hasPendingInvites is true", () => {
    const result = buildTenantOnboarding(makeData({ hasPendingInvites: true }));

    expect(result.steps.find((s) => s.id === "invite-team")?.status).toBe("completed");
  });

  it("sets unavailable status for catalog, brand, and goals when modules not implemented", () => {
    const result = buildTenantOnboarding(makeData());

    expect(result.steps.find((s) => s.id === "configure-catalog")?.status).toBe("unavailable");
    expect(result.steps.find((s) => s.id === "customize-brand")?.status).toBe("unavailable");
    expect(result.steps.find((s) => s.id === "define-goals")?.status).toBe("unavailable");
  });

  it("does not auto-open when fully completed", () => {
    const result = buildTenantOnboarding(makeData({
      hasBranches: true,
      hasActiveMembers: true,
    }));

    expect(result.fullyCompleted).toBe(true);
    expect(result.shouldAutoOpen).toBe(false);
  });

  it("does not auto-open when dismissed even if steps are pending", () => {
    const result = buildTenantOnboarding(makeData({
      onboardingDismissedAt: new Date(),
    }));

    expect(result.dismissed).toBe(true);
    expect(result.shouldAutoOpen).toBe(false);
  });

  it("marks catalog as completed when hasCatalogItems is true", () => {
    const result = buildTenantOnboarding(makeData({ hasCatalogItems: true }));

    expect(result.steps.find((s) => s.id === "configure-catalog")?.status).toBe("completed");
  });

  it("auto-opens when there are pending steps and not dismissed", () => {
    const result = buildTenantOnboarding(makeData());

    expect(result.shouldAutoOpen).toBe(true);
  });
});
