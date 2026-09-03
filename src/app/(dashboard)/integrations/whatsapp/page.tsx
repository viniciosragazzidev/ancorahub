import { DashboardHeader } from "@/components/dashboard-header";
import { getMetaCloudConfigurationState } from "@/features/communication-channels/meta-cloud-config";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { listOwnWahaConnections } from "@/features/waha-cadence/connection-service";
import { getInternalBrokerNotificationPolicy } from "@/features/communication-channels/internal-notification-policy";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { WahaConnectionsCard } from "../../settings/_components/waha-connections-card";
import { WhatsAppPage } from "../../settings/whatsapp-page";

export const dynamic = "force-dynamic";

export default async function WhatsAppIntegrationPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") redirect("/integrations");

  const db = getDatabase();
  const wahaConnectionsEnabled = (await getSystemSetting("feature_waha_connections_enabled")) === "true";
  const [metaEnabled, channels, branches, wahaConnections, internalNotificationPolicy] = await Promise.all([
    isMetaCloudWhatsAppEnabled(),
    db.select({
      id: schema.communicationChannels.id,
      branchId: schema.communicationChannels.branchId,
      displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
      verifiedName: schema.communicationChannels.verifiedName,
      branchName: schema.branches.name,
      status: schema.communicationChannels.status,
      qualityRating: schema.communicationChannels.qualityRating,
      messagingLimit: schema.communicationChannels.messagingLimit,
      registrationStatus: schema.communicationChannels.registrationStatus,
      registrationErrorCode: schema.communicationChannels.registrationErrorCode,
      registeredAt: schema.communicationChannels.registeredAt,
      businessId: schema.communicationChannels.businessId,
      wabaId: schema.communicationChannels.wabaId,
      phoneNumberId: schema.communicationChannels.phoneNumberId,
      lastWebhookAt: schema.communicationChannels.lastWebhookAt,
      activatedAt: schema.communicationChannels.activatedAt,
      tokenExpiresAt: schema.communicationChannels.tokenExpiresAt,
      isDefault: schema.communicationChannels.isDefault,
    }).from(schema.communicationChannels)
      .leftJoin(schema.branches, eq(schema.communicationChannels.branchId, schema.branches.id))
      .where(and(eq(schema.communicationChannels.tenantId, context.tenantId), eq(schema.communicationChannels.provider, "meta_cloud")))
      .orderBy(asc(schema.communicationChannels.displayPhoneNumber)),
    context.role === "director"
      ? db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).orderBy(asc(schema.branches.name))
      : Promise.resolve([] as { id: string; name: string }[]),
    wahaConnectionsEnabled ? listOwnWahaConnections().catch(() => []) : Promise.resolve([]),
    context.role === "director" ? getInternalBrokerNotificationPolicy(context.tenantId) : Promise.resolve(null),
  ]);

  const companyAccount = channels.find((channel) => channel.branchId === null && channel.isDefault) ?? channels.find((channel) => channel.branchId === null) ?? null;

  return <>
    <DashboardHeader breadcrumb="Integrações" title="WhatsApp" />
    <WhatsAppPage
      official={{ ...getMetaCloudConfigurationState(), enabled: metaEnabled, canConfigure: context.role === "director", branches, channels, companyAccount }}
      waha={(context.role === "director" || context.role === "manager") ? <WahaConnectionsCard connections={wahaConnections} enabled={wahaConnectionsEnabled} role={context.role} internalNotificationPolicy={internalNotificationPolicy} /> : null}
    />
  </>;
}
