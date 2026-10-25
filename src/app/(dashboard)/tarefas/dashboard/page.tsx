import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function TasksDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "tasks"); if (await isDirectorLitePageOnServer(context, "/tarefas/dashboard")) return <><DashboardHeader breadcrumb="Tarefas" title="Visão geral" /><main className={litePage.stack}><DomainDashboardLite data={data} actionLabel="Abrir tarefas" /></main></>; return <><DashboardHeader breadcrumb="Tarefas" title="Visão geral" /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
