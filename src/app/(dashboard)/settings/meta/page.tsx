import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { MetaManualIntegrationWorkspace } from "@/features/communication-channels/components/meta-manual-integration-workspace";
import { getMetaLeadAdsConfigurationState } from "@/features/communication-channels/meta-cloud-config";
import { getMetaLeadAdsPlatformIdentity, isMetaLeadAdsTenantPilotEnabled } from "@/features/communication-channels/meta-lead-ads-platform";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationSettingsPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/settings");
  const db = getDatabase();
  const [channel, sources, identity, pilotEnabled] = await Promise.all([
    db.select({ status: schema.communicationChannels.status, displayPhoneNumber: schema.communicationChannels.displayPhoneNumber, verifiedName: schema.communicationChannels.verifiedName })
      .from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, "meta_cloud"), isNull(schema.communicationChannels.branchId), eq(schema.communicationChannels.isDefault, true))).limit(1),
    db.select({ id: schema.metaLeadAdSources.id, pageId: schema.metaLeadAdSources.pageId, status: schema.metaLeadAdSources.status, lastWebhookAt: schema.metaLeadAdSources.lastWebhookAt, lastLeadAt: schema.metaLeadAdSources.lastLeadAt, lastError: schema.metaLeadAdSources.lastError })
      .from(schema.metaLeadAdSources).where(eq(schema.metaLeadAdSources.tenantId, context.tenantId)),
    getMetaLeadAdsPlatformIdentity(),
    isMetaLeadAdsTenantPilotEnabled(context.tenantId),
  ]);
  const config = getMetaLeadAdsConfigurationState();
  return <>
    <DashboardHeader breadcrumb="Configurações / Integrações" title="Meta Business" />
    <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <MetaManualIntegrationWorkspace channel={channel[0] ?? null} identity={identity} leadAdsEnabled={pilotEnabled && config.configured} leadAdsServerReady={config.configured} leadAdsMissingServerConfig={config.missing} leadAdSources={sources} />
    </main>
  </>;
}
