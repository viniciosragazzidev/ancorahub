import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { MetaManualIntegrationWorkspace } from "@/features/communication-channels/components/meta-manual-integration-workspace";
import { getMetaCloudConfigurationState } from "@/features/communication-channels/meta-cloud-config";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationSettingsPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/settings");

  const db = getDatabase();
  const [metaEnabled, channel, settings] = await Promise.all([
    isMetaCloudWhatsAppEnabled(),
    db.select({
      id: schema.communicationChannels.id,
      status: schema.communicationChannels.status,
      businessId: schema.communicationChannels.businessId,
      wabaId: schema.communicationChannels.wabaId,
      phoneNumberId: schema.communicationChannels.phoneNumberId,
      displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
      verifiedName: schema.communicationChannels.verifiedName,
      qualityRating: schema.communicationChannels.qualityRating,
      messagingLimit: schema.communicationChannels.messagingLimit,
      lastWebhookAt: schema.communicationChannels.lastWebhookAt,
      activatedAt: schema.communicationChannels.activatedAt,
    }).from(schema.communicationChannels).where(and(
      eq(schema.communicationChannels.tenantId, context.tenantId),
      eq(schema.communicationChannels.provider, "meta_cloud"),
      isNull(schema.communicationChannels.branchId),
      eq(schema.communicationChannels.isDefault, true),
    )).limit(1),
    db.select({
      id: schema.metaIntegrationSettings.id,
      communicationChannelId: schema.metaIntegrationSettings.communicationChannelId,
      facebookPageId: schema.metaIntegrationSettings.facebookPageId,
      adAccountId: schema.metaIntegrationSettings.adAccountId,
      pixelId: schema.metaIntegrationSettings.pixelId,
      datasetId: schema.metaIntegrationSettings.datasetId,
      tutorialCompletedAt: schema.metaIntegrationSettings.tutorialCompletedAt,
      lastSyncedAt: schema.metaIntegrationSettings.lastSyncedAt,
      lastError: schema.metaIntegrationSettings.lastError,
    }).from(schema.metaIntegrationSettings).where(eq(schema.metaIntegrationSettings.tenantId, context.tenantId)).limit(1),
  ]);
  const activeChannel = channel[0] ?? null;
  const activeSettings = settings[0] ?? null;
  const logTargets = [...new Set([
    context.tenantId,
    ...(activeChannel ? [activeChannel.id] : []),
    ...(activeSettings?.communicationChannelId ? [activeSettings.communicationChannelId] : []),
  ])];
  const logs = logTargets.length
    ? await db.select({ id: schema.auditLogs.id, action: schema.auditLogs.acao, createdAt: schema.auditLogs.createdAt })
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.entidade, "meta_manual_integration"), inArray(schema.auditLogs.entidadeId, logTargets)))
      .orderBy(desc(schema.auditLogs.createdAt)).limit(30)
    : [];
  const config = getMetaCloudConfigurationState({ includeEmbeddedSignup: false });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://app.ancorahub.com.br";

  return <>
    <DashboardHeader breadcrumb="Configurações / Integrações" title="Meta Business" />
    <MetaManualIntegrationWorkspace
      appId={config.appId}
      channel={activeChannel}
      enabled={metaEnabled}
      logs={logs}
      missingServerConfig={config.missing}
      serverReady={config.configured}
      settings={activeSettings}
      verifyTokenConfigured={!config.missing.includes("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN")}
      webhookUrl={`${baseUrl}/api/webhooks/meta/whatsapp`}
    />
  </>;
}
