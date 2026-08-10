import { DashboardHeader } from "@/components/dashboard-header";
import { getTenantMetaCampaignsPerformance } from "@/features/meta-ads/meta-analytics-service";
import { CampaignsDashboardView } from "@/features/meta-ads/components/campaigns-dashboard-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";
import { RelatedActions } from "@/components/related-actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_campanhas_meta");

  const data = await getTenantMetaCampaignsPerformance(context.tenantId);

  return (
    <>
      <DashboardHeader breadcrumb="Marketing" title="Campanhas Meta Ads & ROI" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <CampaignsDashboardView campaigns={data.campaigns} totals={data.totals} />

        <RelatedActions
          title="Ferramentas & Integrações de Marketing"
          description="Navegação contextual para captação de leads e anúncios."
          links={[
            { label: "Importações de Leads Meta", href: "/marketing/importacoes", description: "Logs de entrada e formulários" },
            { label: "Materiais de Divulgação", href: "/materiais-divulgacao", description: "Banners, e-books e artes de apoio" },
            { label: "Configurar Webhooks Meta Lead Ads", href: "/settings?tab=integrations", description: "Token de acesso e formulários" },
            { label: "Regras de Qualificação IA", href: "/qualificacao", description: "Como a IA atende os novos leads" },
          ]}
        />
      </main>
    </>
  );
}
