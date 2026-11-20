import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function TeamDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "team");
  // Resumo do topo (anatomia de página) com os números que o painel já carregou.
  const metric = (label: string) => Number(data.metrics.find((item) => item.label === label)?.value ?? 0);
  const activeMembers = metric("Membros ativos");
  const inService = metric("Em atendimento");
  const summary = `${activeMembers.toLocaleString("pt-BR")} ${activeMembers === 1 ? "membro ativo" : "membros ativos"} · ${inService.toLocaleString("pt-BR")} em atendimento`;
  // Chave do diretor: só a pele Lite (container da moldura e cartões do contrato), mesmos dados.
  if (await isDirectorLitePageOnServer(context, "/equipe/dashboard")) return <><DashboardHeader breadcrumb="Equipe" title="Visão geral" summary={summary} /><main className={litePage.stack}><DomainDashboardLite data={data} /></main></>;
  return <><DashboardHeader breadcrumb="Equipe" title="Visão geral" summary={summary} /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
