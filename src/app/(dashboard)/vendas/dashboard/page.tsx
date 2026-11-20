import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function SalesDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "sales");
  // Resumo da barra do topo (anatomia de página), com a métrica já carregada (janela de 7 dias do serviço).
  const salesCount = Number(data.metrics.find((metric) => metric.label === "Vendas")?.value ?? 0);
  const pageSummary = `${salesCount.toLocaleString("pt-BR")} ${salesCount === 1 ? "venda" : "vendas"} em 7 dias`;
  // Chave do diretor: só a pele Lite (container da moldura e cartões do contrato), mesmos dados.
  if (await isDirectorLitePageOnServer(context, "/vendas/dashboard")) return <><DashboardHeader breadcrumb="Vendas" title="Visão geral" summary={pageSummary} /><main className={litePage.stack}><DomainDashboardLite data={data} /></main></>;
  return <><DashboardHeader breadcrumb="Vendas" title="Visão geral" summary={pageSummary} /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
