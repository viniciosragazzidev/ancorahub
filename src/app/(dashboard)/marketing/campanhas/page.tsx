import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { ArrowRight } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { MetaAssetCaptureCard, MetaMasterCaptureControl } from "@/features/meta-ads/components/meta-capture-controls";
import { MetaSyncBadge } from "@/features/meta-ads/components/meta-sync-badge";
import { CAPTURE_MODE_LABEL } from "@/features/meta-ads/meta-sync-status";
import { getTenantMetaCampaignsPerformance } from "@/features/meta-ads/meta-analytics-service";
import { CampaignsDashboardView } from "@/features/meta-ads/components/campaigns-dashboard-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";
import { RelatedActions } from "@/components/related-actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_campanhas_meta");

  const [data, marketing] = await Promise.all([
    getTenantMetaCampaignsPerformance(context.tenantId),
    // O controle de captura vive aqui; se a leitura da conexão falhar, o desempenho continua visível.
    getMetaConnectionState().catch((err) => {
      console.error("[CampaignsPage] Failed to fetch connection state:", err);
      return null;
    }),
  ]);
  const canConfigure = context.role === "director" || context.jobTitle === "marketing" || context.role === "manager";
  const connection = marketing?.connection ?? null;
  const assets = marketing?.assets ?? null;
  const connected = connection?.status === "connected";

  return (
    <>
      <DashboardHeader breadcrumb="Marketing" title="Campanhas Meta Ads & ROI" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3">
          {connected && connection ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <MetaSyncBadge logs={marketing?.logs ?? []} lastSyncedAt={connection.lastSyncedAt} />
              <Badge variant="outline" data-slot="capture-mode">
                {CAPTURE_MODE_LABEL[connection.globalCaptureMode ?? "selective"]}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A Meta ainda não está conectada. Conecte o Marketing para ver campanhas e controlar a captura de leads.
            </p>
          )}
          <Link
            href="/integrations/meta"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {connected ? "Conexão e sincronização" : "Conectar Marketing"}
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <CampaignsDashboardView campaigns={data.campaigns} totals={data.totals} />

        {connected && connection && assets ? (
          <section aria-label="Controle de captura de leads" className="space-y-4">
            <MetaMasterCaptureControl globalMode={connection.globalCaptureMode ?? "selective"} canConfigure={canConfigure} />
            <MetaAssetCaptureCard assets={assets} canConfigure={canConfigure} />
          </section>
        ) : null}

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
