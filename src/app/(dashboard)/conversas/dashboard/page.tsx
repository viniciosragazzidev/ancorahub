import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
export const dynamic = "force-dynamic";
export default async function ConversationsDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "conversations");
  // Chave do diretor: só a pele Lite (container da moldura e cartões do contrato), mesmos dados.
  if (await isDirectorLitePageOnServer(context.role, context.tenantId, "/conversas/dashboard")) return <><DashboardHeader breadcrumb="Conversas" title="Visão geral" /><main className={litePage.stack}><DomainDashboardLite data={data} /></main></>;
  return <><DashboardHeader breadcrumb="Conversas" title="Visão geral" /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
