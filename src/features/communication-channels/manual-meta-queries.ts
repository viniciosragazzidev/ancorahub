import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { getMetaLeadAdsConfigurationState } from "./meta-cloud-config";
import { isMetaLeadAdsEnabled } from "./meta-lead-ads";
import { getMetaLeadAdsPlatformIdentity } from "./meta-lead-ads-platform";
import { META_CLOUD_PROVIDER } from "./types";

/**
 * Read model for the guided Meta setup. The caller provides only the trusted
 * server-side session context; no tenant identifier crosses the browser boundary.
 */
export async function getManualMetaIntegrationWorkspaceData(context: TenantContext) {
  const db = getDatabase();
  const leadAdsConfig = getMetaLeadAdsConfigurationState();

  const [identity, leadAdsEnabled, channels, leadAdSources] = await Promise.all([
    getMetaLeadAdsPlatformIdentity(),
    isMetaLeadAdsEnabled(context.tenantId),
    db
      .select({
        status: schema.communicationChannels.status,
        displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
        verifiedName: schema.communicationChannels.verifiedName,
      })
      .from(schema.communicationChannels)
      .where(
        and(
          eq(schema.communicationChannels.tenantId, context.tenantId),
          eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
          eq(schema.communicationChannels.isDefault, true),
          isNull(schema.communicationChannels.branchId),
        ),
      )
      .limit(1),
    db
      .select({
        id: schema.metaLeadAdSources.id,
        pageId: schema.metaLeadAdSources.pageId,
        status: schema.metaLeadAdSources.status,
        lastWebhookAt: schema.metaLeadAdSources.lastWebhookAt,
        lastLeadAt: schema.metaLeadAdSources.lastLeadAt,
        lastError: schema.metaLeadAdSources.lastError,
      })
      .from(schema.metaLeadAdSources)
      .where(eq(schema.metaLeadAdSources.tenantId, context.tenantId))
      .orderBy(desc(schema.metaLeadAdSources.updatedAt)),
  ]);

  return {
    leadAdsEnabled,
    leadAdsServerReady: leadAdsConfig.configured,
    leadAdsMissingServerConfig: leadAdsConfig.missing,
    identity,
    channel: channels[0] ?? null,
    leadAdSources,
  };
}
