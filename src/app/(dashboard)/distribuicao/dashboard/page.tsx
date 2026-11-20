import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { DirectorDistributionDashboard } from "../_components/director-distribution-dashboard";

export const dynamic = "force-dynamic";

export default async function DistributionDashboardPage() {
  const context = await getRequiredTenantContext();
  const data = await getDomainDashboard(context, "distribution");
  const directorLite = await isDirectorLitePageOnServer(context, "/distribuicao/dashboard");
  // Resumo da barra do topo (anatomia de página), com as métricas já carregadas (janela de 7 dias do serviço).
  const metricValue = (label: string) => Number(data.metrics.find((metric) => metric.label === label)?.value ?? 0);
  const received = metricValue("Recebidos");
  const assigned = metricValue("Atribuídos");
  const pageSummary = `${received.toLocaleString("pt-BR")} ${received === 1 ? "recebido" : "recebidos"} · ${assigned.toLocaleString("pt-BR")} ${assigned === 1 ? "atribuído" : "atribuídos"} em 7 dias`;

  if (directorLite) {
    return (
      <>
        <DashboardHeader breadcrumb="Distribuição" title="Visão geral" summary={pageSummary} />
        <main className="flex min-w-0 flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6">
          <DirectorDistributionDashboard data={data} />
        </main>
      </>
    );
  }

  return <><DashboardHeader breadcrumb="Distribuição" title="Visão geral" summary={pageSummary} /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>;
}
