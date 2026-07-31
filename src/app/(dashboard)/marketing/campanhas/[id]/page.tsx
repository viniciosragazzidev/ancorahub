import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { CampaignDetailView } from "@/features/meta-ads/components/campaign-detail-view";
import { getTenantMetaCampaignsPerformance } from "@/features/meta-ads/meta-analytics-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_campanhas_meta");

  const data = await getTenantMetaCampaignsPerformance(context.tenantId);
  const campaign = data.campaigns.find((c) => c.id === params.id || c.campaignId === params.id);

  if (!campaign) {
    notFound();
  }

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Campanhas" title={`Campanha: ${campaign.name}`} />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignDetailView campaign={campaign} />
      </main>
    </>
  );
}
