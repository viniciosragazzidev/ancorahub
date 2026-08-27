import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
  getQualificationTenantSettings: vi.fn(),
  getTenantTestNumbers: vi.fn(),
  getWhatsAppDiagnosticStatus: vi.fn(),
  getFollowUpRules: vi.fn(),
  getToolPermissions: vi.fn(),
  getDestinationRules: vi.fn(),
  getBrokerEligibilityProfiles: vi.fn(),
  getQualificationStats: vi.fn(),
  getQualificationAlerts: vi.fn(),
  getAgentTrainingCenter: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.getRequiredTenantContext }));
vi.mock("@/shared/auth/permissions", () => ({ hasCapability: () => true }));
vi.mock("@/features/ai-qualification/tenant-settings-service", () => ({ getQualificationTenantSettings: mocks.getQualificationTenantSettings }));
vi.mock("@/features/ai-qualification/test-numbers-service", () => ({ getTenantTestNumbers: mocks.getTenantTestNumbers }));
vi.mock("@/features/ai-qualification/whatsapp-diagnostic-service", () => ({ getWhatsAppDiagnosticStatus: mocks.getWhatsAppDiagnosticStatus }));
vi.mock("@/features/ai-qualification/followup-service", () => ({ getFollowUpRules: mocks.getFollowUpRules }));
vi.mock("@/features/ai-qualification/tool-governance-service", () => ({ getToolPermissions: mocks.getToolPermissions }));
vi.mock("@/features/ai-qualification/destination-routing-service", () => ({
  getDestinationRules: mocks.getDestinationRules,
  getBrokerEligibilityProfiles: mocks.getBrokerEligibilityProfiles,
}));
vi.mock("@/features/ai-qualification/stats-service", () => ({ getQualificationStats: mocks.getQualificationStats }));
vi.mock("@/features/ai-qualification/alerts-service", () => ({ getQualificationAlerts: mocks.getQualificationAlerts }));
vi.mock("@/features/agent-training/actions", () => ({ getAgentTrainingCenter: mocks.getAgentTrainingCenter }));
vi.mock("./_components/qualification-hub-client", () => ({ QualificationHubClient: () => null }));

import QualificacaoPage from "./page";

describe("/qualificacao", () => {
  it("carrega os dados do tenant sem executar migrações durante a renderização", async () => {
    mocks.getRequiredTenantContext.mockResolvedValue({ tenantId: "tenant-test", userId: "director-test", role: "director", jobTitle: "director" });
    for (const loader of [
      mocks.getQualificationTenantSettings,
      mocks.getTenantTestNumbers,
      mocks.getWhatsAppDiagnosticStatus,
      mocks.getFollowUpRules,
      mocks.getToolPermissions,
      mocks.getDestinationRules,
      mocks.getBrokerEligibilityProfiles,
      mocks.getQualificationStats,
      mocks.getQualificationAlerts,
      mocks.getAgentTrainingCenter,
    ]) loader.mockResolvedValue([]);

    await expect(QualificacaoPage()).resolves.toBeDefined();
    expect(mocks.getQualificationTenantSettings).toHaveBeenCalledWith("tenant-test");
    expect(mocks.getToolPermissions).toHaveBeenCalledWith("tenant-test");
    expect(mocks.getQualificationStats).toHaveBeenCalledWith("tenant-test");
    expect(mocks.getQualificationAlerts).toHaveBeenCalledWith("tenant-test");
    expect(mocks.getAgentTrainingCenter).toHaveBeenCalledOnce();
  });

  it("mantém a central disponível quando um diagnóstico auxiliar falha", async () => {
    mocks.getRequiredTenantContext.mockResolvedValue({ tenantId: "tenant-test", userId: "director-test", role: "director", jobTitle: "director" });
    for (const loader of [
      mocks.getQualificationTenantSettings,
      mocks.getTenantTestNumbers,
      mocks.getFollowUpRules,
      mocks.getToolPermissions,
      mocks.getDestinationRules,
      mocks.getBrokerEligibilityProfiles,
      mocks.getQualificationStats,
      mocks.getQualificationAlerts,
      mocks.getAgentTrainingCenter,
    ]) loader.mockResolvedValue([]);
    mocks.getWhatsAppDiagnosticStatus.mockRejectedValue(new Error("database temporarily unavailable"));

    await expect(QualificacaoPage()).resolves.toBeDefined();
  });
});
