import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { hasCapability } from "@/shared/auth/permissions";
import { getQualificationTenantSettings } from "@/features/ai-qualification/tenant-settings-service";
import { getTenantTestNumbers } from "@/features/ai-qualification/test-numbers-service";
import { getWhatsAppDiagnosticStatus, type WhatsAppConnectionDiagnostic } from "@/features/ai-qualification/whatsapp-diagnostic-service";
import { getFollowUpRules } from "@/features/ai-qualification/followup-service";
import { getToolPermissions } from "@/features/ai-qualification/tool-governance-service";
import { getDestinationRules, getBrokerEligibilityProfiles } from "@/features/ai-qualification/destination-routing-service";
import { getQualificationStats } from "@/features/ai-qualification/stats-service";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { getAgentTrainingCenter } from "@/features/agent-training/actions";
import { QualificationHubClient } from "./_components/qualification-hub-client";

export const dynamic = "force-dynamic";

const QUALIFICATION_SECTION_SLOW_MS = 750;

function unavailableWhatsAppDiagnostic(tenantId: string): WhatsAppConnectionDiagnostic {
  return {
    channelConnected: false,
    officialNumber: null,
    displayName: null,
    tenantId,
    wabaId: null,
    phoneNumberId: null,
    webhookStatus: "unavailable",
    tokenStatus: "unconfigured",
    tokenExpirationDays: null,
    lastMessageReceivedAt: null,
    lastMessageSentAt: null,
    lastError: "Diagnóstico indisponível temporariamente.",
    averageLatencyMs: 0,
    configVersion: 0,
    overallHealth: "incomplete_config",
  };
}

async function loadQualificationSection<T>(section: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  const startedAt = Date.now();
  try {
    return await loader();
  } catch (error) {
    // Keep logs correlation-safe: no tenant IDs, message bodies or contact data.
    console.error("[qualification-page] section_unavailable", {
      section,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= QUALIFICATION_SECTION_SLOW_MS) {
      console.warn("[qualification-page] slow_section", { section, durationMs });
    }
  }
}

export default async function QualificacaoPage() {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) {
    throw new AuthorizationError("Apenas diretores, gestores e equipe de marketing têm permissão para acessar a qualificação por IA.");
  }

  // Do not allow this operational settings page to monopolize the small VPS
  // connection pool. Independent sections remain usable if one read fails.
  const settings = await loadQualificationSection("settings", () => getQualificationTenantSettings(context.tenantId), null);

  const [testNumbers, whatsappDiagnostic, followUpRules] = await Promise.all([
    loadQualificationSection("test_numbers", () => getTenantTestNumbers(context.tenantId), []),
    loadQualificationSection("whatsapp_diagnostic", () => getWhatsAppDiagnosticStatus(context.tenantId), unavailableWhatsAppDiagnostic(context.tenantId)),
    loadQualificationSection("follow_up_rules", () => getFollowUpRules(context.tenantId), []),
  ]);

  const [toolPermissions, destinationRules, brokerProfiles] = await Promise.all([
    loadQualificationSection("tool_permissions", () => getToolPermissions(context.tenantId), []),
    loadQualificationSection("destination_rules", () => getDestinationRules(context.tenantId), []),
    loadQualificationSection("broker_profiles", () => getBrokerEligibilityProfiles(context.tenantId), []),
  ]);

  const [stats, alerts, agentTraining] = await Promise.all([
    loadQualificationSection("stats", () => getQualificationStats(context.tenantId), {
      operation: { startedToday: 0, active: 0, completed: 0, paused: 0, withError: 0, transferredToHuman: 0 },
      qualification: { totalQualified: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, unqualified: 0, noResponse: 0, completionRatePct: 0, abandonmentRatePct: 0 },
      distribution: { distributed: 0, waitingQueue: 0, noDestination: 0, avgTimeMsToDistribution: 0, avgTimeMsToBrokerTakeover: 0, slaRedistributions: 0, distributionFailures: 0 },
      costs: { messagesSent: 0, aiCalls: 0, inputTokens: 0, outputTokens: 0, aiCostBrl: 0, whatsappCostBrl: 0, avgCostPerSessionBrl: 0, avgCostPerQualifiedBrl: 0 },
      followup: { scheduled: 0, sent: 0, responded: 0, interrupted: 0, conversionsPostFollowup: 0, costPerRecoveryBrl: 0 },
    }),
    loadQualificationSection("alerts", () => getQualificationAlerts(context.tenantId), []),
    loadQualificationSection("agent_training", () => getAgentTrainingCenter(), {
      canEdit: false,
      enabled: false,
      versions: [],
      brokers: [],
      distributionPolicy: null,
    }),
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
      agentTraining={agentTraining}
    />
  );
}
