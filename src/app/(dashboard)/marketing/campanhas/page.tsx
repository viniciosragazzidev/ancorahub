import { DashboardHeader } from "@/components/dashboard-header";
import { getTenantMetaCampaignsPerformance } from "@/features/meta-ads/meta-analytics-service";
import { CampaignsDashboardView } from "@/features/meta-ads/components/campaigns-dashboard-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const context = await getRequiredTenantContext();

  const data = await getTenantMetaCampaignsPerformance(context.tenantId);

  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Operação Meta" title="Desempenho Comercial por Campanha" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignsDashboardView campaigns={data.campaigns} totals={data.totals} />
      </main>
    </>
  );
}
