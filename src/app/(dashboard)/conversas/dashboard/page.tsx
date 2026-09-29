import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDomainDashboard } from "@/features/dashboard/service";
import { DomainDashboard } from "@/features/dashboard/components/domain-dashboard";
export const dynamic = "force-dynamic";
export default async function ConversationsDashboardPage() { const context = await getRequiredTenantContext(); const data = await getDomainDashboard(context, "conversations"); return <><DashboardHeader breadcrumb="Conversas" title="Visão geral" /><main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) lg:p-6"><DomainDashboard data={data} /></main></>; }
