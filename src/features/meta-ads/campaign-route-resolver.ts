import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

/**
 * Resolve the canonical Meta campaign route, with a compatibility read for
 * legacy rows written using the CRM's internal campaign UUID.
 */
export async function resolveMetaCampaignQueueRoute(tenantId: string, metaCampaignId: string) {
  const db = getDatabase();
  const [campaign] = await db
    .select({ id: schema.metaCampaigns.id, adAccountId: schema.metaCampaigns.adAccountId })
    .from(schema.metaCampaigns)
    .where(and(
      eq(schema.metaCampaigns.tenantId, tenantId),
      eq(schema.metaCampaigns.campaignId, metaCampaignId),
    ))
    .limit(1);

  const routeKeys = [...new Set([metaCampaignId, campaign?.id].filter((value): value is string => Boolean(value)))];
  if (!routeKeys.length) return undefined;
  const routes = await db
    .select({
      campaignId: schema.metaCampaignQueueRoutes.campaignId,
      queueId: schema.metaCampaignQueueRoutes.queueId,
      enabled: schema.metaCampaignQueueRoutes.enabled,
      queueName: schema.leadQueues.name,
      queueStatus: schema.leadQueues.status,
    })
    .from(schema.metaCampaignQueueRoutes)
    .leftJoin(schema.leadQueues, and(
      eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id),
      eq(schema.metaCampaignQueueRoutes.tenantId, schema.leadQueues.tenantId),
    ))
    .where(and(
      eq(schema.metaCampaignQueueRoutes.tenantId, tenantId),
      inArray(schema.metaCampaignQueueRoutes.campaignId, routeKeys),
    ));

  const campaignRoute = routes.find((route) => route.campaignId === metaCampaignId) ?? routes[0];
  if (!campaign?.adAccountId) return campaignRoute;

  const [accountDefault] = await db
    .select({
      queueId: schema.metaAdAccounts.defaultQueueId,
      queueName: schema.leadQueues.name,
      queueStatus: schema.leadQueues.status,
    })
    .from(schema.metaAdAccounts)
    .leftJoin(schema.leadQueues, and(
      eq(schema.leadQueues.id, schema.metaAdAccounts.defaultQueueId),
      eq(schema.leadQueues.tenantId, schema.metaAdAccounts.tenantId),
    ))
    .where(and(
      eq(schema.metaAdAccounts.tenantId, tenantId),
      eq(schema.metaAdAccounts.adAccountId, campaign.adAccountId),
    ))
    .limit(1);

  if (!accountDefault?.queueId) return campaignRoute;
  if (campaignRoute) {
    return campaignRoute.queueId ? campaignRoute : {
      ...campaignRoute,
      queueId: accountDefault.queueId,
      queueName: accountDefault.queueName,
      queueStatus: accountDefault.queueStatus,
    };
  }

  return {
    campaignId: metaCampaignId,
    queueId: accountDefault.queueId,
    enabled: true,
    queueName: accountDefault.queueName,
    queueStatus: accountDefault.queueStatus,
  };
}

/**
 * Recover missing webhook attribution in order: explicit campaign, synced ad
 * hierarchy, then a form's unique historical campaign within this tenant.
 * Shared forms are deliberately ambiguous and are never guessed.
 */
export async function resolveMetaCampaignAttribution(input: {
  tenantId: string;
  campaignId?: string | null;
  adId?: string | null;
  formId?: string | null;
}): Promise<{ campaignId: string | null; adSetId: string | null; resolvedBy: "campaign" | "ad" | "form" | "unresolved" }> {
  if (input.campaignId) return { campaignId: input.campaignId, adSetId: null, resolvedBy: "campaign" };

  const db = getDatabase();
  if (input.adId) {
    const [ad] = await db.select({ campaignId: schema.metaAdSets.campaignId, adSetId: schema.metaAds.adSetId })
      .from(schema.metaAds)
      .innerJoin(schema.metaAdSets, and(
        eq(schema.metaAdSets.tenantId, schema.metaAds.tenantId),
        eq(schema.metaAdSets.adSetId, schema.metaAds.adSetId),
      ))
      .where(and(eq(schema.metaAds.tenantId, input.tenantId), eq(schema.metaAds.adId, input.adId)))
      .limit(1);
    if (ad?.campaignId) return { campaignId: ad.campaignId, adSetId: ad.adSetId, resolvedBy: "ad" };
  }

  if (input.formId) {
    const campaigns = await db.selectDistinct({ campaignId: schema.leads.metaCampaignId })
      .from(schema.leads)
      .innerJoin(schema.metaCampaignQueueRoutes, and(
        eq(schema.metaCampaignQueueRoutes.tenantId, schema.leads.tenantId),
        eq(schema.metaCampaignQueueRoutes.campaignId, schema.leads.metaCampaignId),
        eq(schema.metaCampaignQueueRoutes.enabled, true),
      ))
      .innerJoin(schema.leadQueues, and(
        eq(schema.leadQueues.tenantId, schema.metaCampaignQueueRoutes.tenantId),
        eq(schema.leadQueues.id, schema.metaCampaignQueueRoutes.queueId),
        eq(schema.leadQueues.status, "active"),
      ))
      .where(and(
        eq(schema.leads.tenantId, input.tenantId),
        eq(schema.leads.metaFormId, input.formId),
        isNotNull(schema.leads.metaCampaignId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      ))
      .limit(2);
    if (campaigns.length === 1 && campaigns[0].campaignId) {
      return { campaignId: campaigns[0].campaignId, adSetId: null, resolvedBy: "form" };
    }
  }

  return { campaignId: null, adSetId: null, resolvedBy: "unresolved" };
}
