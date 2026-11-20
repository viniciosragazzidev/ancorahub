import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function TasksDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "tasks");
  // Resumo do topo (anatomia de página) com os números que o painel já carregou.
  const metric = (label: string) => Number(data.metrics.find((item) => item.label === label)?.value ?? 0);
  const open = metric("Em aberto");
  const withDue = metric("Com prazo");
  const summary = `${open.toLocaleString("pt-BR")} ${open === 1 ? "tarefa" : "tarefas"} em aberto · ${withDue.toLocaleString("pt-BR")} com prazo`;
  if (await isDirectorLitePageOnServer(context, "/tarefas/dashboard")) return <><DashboardHeader breadcrumb="Tarefas" title="Visão geral" summary={summary} /><main className={litePage.stack}><DomainDashboardLite data={data} actionLabel="Abrir tarefas" /></main></>; return <><DashboardHeader breadcrumb="Tarefas" title="Visão geral" summary={summary} /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
