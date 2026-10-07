import { notFound } from "next/navigation";
import { and, count, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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
  let campaign = data.campaigns.find((c) => c.id === params.id || c.campaignId === params.id);

  if (!campaign) {
    const [dbCampaign] = await db
      .select({
        id: schema.metaCampaigns.id,
        tenantId: schema.metaCampaigns.tenantId,
        adAccountId: schema.metaCampaigns.adAccountId,
        campaignId: schema.metaCampaigns.campaignId,
        name: schema.metaCampaigns.name,
        objective: schema.metaCampaigns.objective,
        status: schema.metaCampaigns.status,
        dailyBudget: schema.metaCampaigns.dailyBudget,
        lifetimeBudget: schema.metaCampaigns.lifetimeBudget,
        startTime: schema.metaCampaigns.startTime,
        stopTime: schema.metaCampaigns.stopTime,
      })
      .from(schema.metaCampaigns)
      .where(
        and(
          eq(schema.metaCampaigns.tenantId, context.tenantId),
          or(eq(schema.metaCampaigns.id, params.id), eq(schema.metaCampaigns.campaignId, params.id))
        )
      )
      .limit(1);

    if (dbCampaign) {
      campaign = {
        ...dbCampaign,
        adAccountName: `Conta ${dbCampaign.adAccountId}`,
        leadsCount: 0,
        conversationsCount: 0,
        salesCount: 0,
        revenueTotal: 0,
        conversionRate: 0,
        ads: [],
      };
    }
  }

  if (!campaign) {
    notFound();
  }

  // Fetch active distribution queues, campaign route, and ad sets/ads for this campaign
  const [queues, currentRoutes, adSets, adLeadCounts, accountDefaults] = await Promise.all([
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
        campaignId: schema.metaCampaignQueueRoutes.campaignId,
        queueId: schema.metaCampaignQueueRoutes.queueId,
        enabled: schema.metaCampaignQueueRoutes.enabled,
      })
      .from(schema.metaCampaignQueueRoutes)
      .where(
        and(
          eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId),
          inArray(schema.metaCampaignQueueRoutes.campaignId, [campaign.campaignId, campaign.id]),
        ),
      )
      .limit(2),
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
    db
      .select({ queueId: schema.metaAdAccounts.defaultQueueId, queueStatus: schema.leadQueues.status })
      .from(schema.metaAdAccounts)
      .leftJoin(schema.leadQueues, and(
        eq(schema.leadQueues.id, schema.metaAdAccounts.defaultQueueId),
        eq(schema.leadQueues.tenantId, schema.metaAdAccounts.tenantId),
      ))
      .where(and(
        eq(schema.metaAdAccounts.tenantId, context.tenantId),
        eq(schema.metaAdAccounts.adAccountId, campaign.adAccountId),
      ))
      .limit(1),
  ]);

  const adSetIds = adSets.map((s) => s.adSetId);

  const rawAds = adSetIds.length
    ? await db
        .select({
          id: schema.metaAds.id,
          adId: schema.metaAds.adId,
          leadGenFormId: schema.metaAds.leadGenFormId,
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

  // Forms are related through actual lead attribution, since Meta forms can be
  // shared and the local campaign/ad snapshot does not claim ownership.
  const campaignFormAttributions = await db.selectDistinct({ formId: schema.leads.metaFormId })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, context.tenantId),
      or(
        eq(schema.leads.metaCampaignId, campaign.campaignId),
        campaignAds.length ? inArray(schema.leads.metaAdId, campaignAds.map((ad) => ad.adId)) : undefined,
      ),
      isNotNull(schema.leads.metaFormId),
      isNull(schema.leads.deletedAt),
    ));
  const campaignFormIds = [...new Set([
    ...campaignFormAttributions.map((item) => item.formId).filter((id): id is string => Boolean(id)),
    ...campaignAds.map((ad) => ad.leadGenFormId).filter((id): id is string => Boolean(id)),
  ])];
  const syncedCampaignForms = campaignFormIds.length
    ? await db.select({ id: schema.metaLeadForms.id, formId: schema.metaLeadForms.formId, name: schema.metaLeadForms.name, status: schema.metaLeadForms.status, locale: schema.metaLeadForms.locale })
      .from(schema.metaLeadForms)
      .where(and(eq(schema.metaLeadForms.tenantId, context.tenantId), inArray(schema.metaLeadForms.formId, campaignFormIds)))
      .orderBy(schema.metaLeadForms.name)
    : [];
  const syncedFormIds = new Set(syncedCampaignForms.map((form) => form.formId));
  const campaignForms = [
    ...syncedCampaignForms,
    ...campaignFormIds.filter((formId) => !syncedFormIds.has(formId)).map((formId) => ({
      id: `meta-form:${formId}`,
      formId,
      name: `Formulário Meta ${formId}`,
      status: "UNKNOWN",
      locale: null,
    })),
  ];

  // Prefer the Meta ID; older bulk activation wrote the CRM UUID instead.
  const storedRoute = currentRoutes.find((route) => route.campaignId === campaign.campaignId) ?? currentRoutes[0];
  const accountDefault = accountDefaults[0]?.queueStatus === "active" ? accountDefaults[0].queueId : null;
  const currentRoute = storedRoute
    ? { ...storedRoute, queueId: storedRoute.queueId ?? accountDefault }
    : accountDefault
      ? { campaignId: campaign.campaignId, queueId: accountDefault, enabled: true }
      : undefined;
  const canConfigureCapture = context.role === "director" || context.role === "manager" || context.jobTitle === "marketing";

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Campanhas" title={`Campanha: ${campaign.name}`} />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignDetailView
          campaign={campaign}
          ads={campaignAds}
          forms={campaignForms}
          queues={queues}
          initialQueueId={currentRoute?.queueId ?? null}
          initialCaptureEnabled={currentRoute?.enabled ?? false}
          canConfigureCapture={canConfigureCapture}
          canDisableCapture={context.role === "director"}
        />
      </main>
    </>
  );
}
