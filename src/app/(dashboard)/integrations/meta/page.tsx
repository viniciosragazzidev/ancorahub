import { and, asc, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { MetaIntegrationHub } from "@/features/communication-channels/components/meta-integration-hub";
import { getMetaCloudConfigurationState } from "@/features/communication-channels/meta-cloud-config";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");
  const db = getDatabase();
  const [marketing, metaEnabled, channels] = await Promise.all([
    getMetaConnectionState(),
    isMetaCloudWhatsAppEnabled(),
    db.select({
      branchId: schema.communicationChannels.branchId,
      displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
      verifiedName: schema.communicationChannels.verifiedName,
      status: schema.communicationChannels.status,
      qualityRating: schema.communicationChannels.qualityRating,
      messagingLimit: schema.communicationChannels.messagingLimit,
      businessId: schema.communicationChannels.businessId,
      wabaId: schema.communicationChannels.wabaId,
      phoneNumberId: schema.communicationChannels.phoneNumberId,
      lastWebhookAt: schema.communicationChannels.lastWebhookAt,
      activatedAt: schema.communicationChannels.activatedAt,
      isDefault: schema.communicationChannels.isDefault,
    }).from(schema.communicationChannels).where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, "meta_cloud"))).orderBy(asc(schema.communicationChannels.displayPhoneNumber)),
  ]);
  const companyAccount = channels.find((channel) => channel.branchId === null && channel.isDefault) ?? channels.find((channel) => channel.branchId === null) ?? null;
  const cloud = getMetaCloudConfigurationState();
  return <><DashboardHeader breadcrumb="Integrações" title="Meta Business" /><main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:p-6"><MetaIntegrationHub marketing={{ connection: marketing.connection, logs: marketing.logs }} canConfigure={context.role === "director"} whatsapp={{ enabled: metaEnabled, configured: cloud.configured, missing: cloud.missing, appId: cloud.appId, configId: cloud.embeddedSignupConfigId, companyAccount }} /></main></>;
}
