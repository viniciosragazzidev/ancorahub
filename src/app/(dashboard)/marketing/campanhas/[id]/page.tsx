import { notFound } from "next/navigation";
import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard-header";
import { CampaignDetailView } from "@/features/meta-ads/components/campaign-detail-view";
import { getTenantMetaCampaignsPerformance } from "@/features/meta-ads/meta-analytics-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_campanhas_meta");

  const db = getDatabase();

  const data = await getTenantMetaCampaignsPerformance(context.tenantId);
  const campaign = data.campaigns.find((c) => c.id === params.id || c.campaignId === params.id);

  if (!campaign) {
    notFound();
  }

  // Fetch active distribution queues, campaign route, and ad sets/ads for this campaign
  const [queues, currentRoutes, adSets, adLeadCounts] = await Promise.all([
    db
      .select({
        id: schema.leadQueues.id,
        name: schema.leadQueues.name,
        branchName: schema.branches.name,
      })
      .from(schema.leadQueues)
      .leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"))),
    db
      .select({
        queueId: schema.metaCampaignQueueRoutes.queueId,
        enabled: schema.metaCampaignQueueRoutes.enabled,
      })
      .from(schema.metaCampaignQueueRoutes)
      .where(
        and(
          eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId),
          eq(schema.metaCampaignQueueRoutes.campaignId, campaign.campaignId),
        ),
      )
      .limit(1),
    db
      .select({ adSetId: schema.metaAdSets.adSetId })
      .from(schema.metaAdSets)
      .where(and(eq(schema.metaAdSets.tenantId, context.tenantId), eq(schema.metaAdSets.campaignId, campaign.campaignId))),
    db
      .select({
        metaAdId: schema.leads.metaAdId,
        total: count(schema.leads.id),
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.metaCampaignId, campaign.campaignId),
          isNull(schema.leads.deletedAt),
          isNotNull(schema.leads.metaAdId),
        ),
      )
      .groupBy(schema.leads.metaAdId),
  ]);

  const adSetIds = adSets.map((s) => s.adSetId);

  const rawAds = adSetIds.length
    ? await db
        .select({
          id: schema.metaAds.id,
          adId: schema.metaAds.adId,
          name: schema.metaAds.name,
          status: schema.metaAds.status,
          adSetId: schema.metaAds.adSetId,
        })
        .from(schema.metaAds)
        .where(and(eq(schema.metaAds.tenantId, context.tenantId), inArray(schema.metaAds.adSetId, adSetIds)))
    : [];

  const leadCountMap = new Map(adLeadCounts.map((r) => [r.metaAdId!, Number(r.total)]));

  const campaignAds = rawAds.map((ad) => ({
    ...ad,
    leadsCount: leadCountMap.get(ad.adId) ?? 0,
  }));

  const currentRoute = currentRoutes[0];

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Campanhas" title={`Campanha: ${campaign.name}`} />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignDetailView
          campaign={campaign}
          ads={campaignAds}
          queues={queues}
          initialQueueId={currentRoute?.queueId ?? null}
        />
      </main>
    </>
  );
}
