import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
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

  // Fetch active distribution queues and existing route for this campaign
  const [queues, currentRoutes] = await Promise.all([
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
  ]);

  const currentRoute = currentRoutes[0];

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Campanhas" title={`Campanha: ${campaign.name}`} />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignDetailView
          campaign={campaign}
          queues={queues}
          initialQueueId={currentRoute?.queueId ?? null}
        />
      </main>
    </>
  );
}
