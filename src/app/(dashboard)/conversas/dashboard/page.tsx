import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function ConversationsDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "conversations");
  // Resumo do topo (anatomia de página): as métricas que a página já carrega, dos últimos 7 dias.
  const summary = `${data.metrics.map((metric) => `${typeof metric.value === "number" ? metric.value.toLocaleString("pt-BR") : metric.value} ${metric.label.toLowerCase()}`).join(" · ")} · 7 dias`;
  // Chave do diretor: só a pele Lite (container da moldura e cartões do contrato), mesmos dados.
  if (await isDirectorLitePageOnServer(context, "/conversas/dashboard")) return <><DashboardHeader breadcrumb="Conversas" title="Visão geral" summary={summary} /><main className={litePage.stack}><DomainDashboardLite data={data} /></main></>;
  return <><DashboardHeader breadcrumb="Conversas" title="Visão geral" summary={summary} /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
