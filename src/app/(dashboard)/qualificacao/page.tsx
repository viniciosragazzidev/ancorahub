import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getTenantTestNumbers } from "@/features/ai-qualification/test-numbers-service";
import { getWhatsAppDiagnosticStatus } from "@/features/ai-qualification/whatsapp-diagnostic-service";
import { getFollowUpRules } from "@/features/ai-qualification/followup-service";
import { getToolPermissions } from "@/features/ai-qualification/tool-governance-service";
import { getDestinationRules, getBrokerEligibilityProfiles } from "@/features/ai-qualification/destination-routing-service";
import { getQualificationStats } from "@/features/ai-qualification/stats-service";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { ensureAiTablesExist } from "@/features/ai-agent/conversation-state-machine";
import { QualificationHubClient } from "./_components/qualification-hub-client";

export const dynamic = "force-dynamic";

export default async function QualificacaoPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores têm permissão para acessar a qualificação por IA.");
  }

  await ensureAiTablesExist();

  const [
    settings,
    testNumbers,
    whatsappDiagnostic,
    followUpRules,
    toolPermissions,
    destinationRules,
    brokerProfiles,
    stats,
    alerts,
  ] = await Promise.all([
    getQualificationTenantSettings(context.tenantId),
    getTenantTestNumbers(context.tenantId),
    getWhatsAppDiagnosticStatus(context.tenantId),
    getFollowUpRules(context.tenantId),
    getToolPermissions(context.tenantId),
    getDestinationRules(context.tenantId),
    getBrokerEligibilityProfiles(context.tenantId),
    getQualificationStats(context.tenantId),
    getQualificationAlerts(context.tenantId),
  ]);

  return (
    <QualificationHubClient
      settings={settings}
      testNumbers={testNumbers}
      whatsappDiagnostic={whatsappDiagnostic}
      followUpRules={followUpRules}
      toolPermissions={toolPermissions}
      destinationRules={destinationRules}
      brokerProfiles={brokerProfiles}
      stats={stats}
      alerts={alerts}
    />
  );
}
