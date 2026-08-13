import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectorPerformanceManager } from "@/features/performance/components/director-performance-manager";
import { getDirectorPerformanceWorkspace, isPerformanceRankingEnabled } from "@/features/performance/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function DirectorPerformancePage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const enabled = await isPerformanceRankingEnabled();
  if (!enabled) return <>
    <DashboardHeader breadcrumb="Gestão comercial / Metas" title="Temporadas e ranking" />
    <main className="flex min-h-full flex-col gap-5 bg-background p-4 lg:p-6">
      <Card>
        <CardHeader><CardTitle>Ranking temporariamente desativado</CardTitle><CardDescription>O Super Admin pausou este recurso. As temporadas, metas e premiações já configuradas permanecem preservadas.</CardDescription></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Peça a liberação ao administrador da plataforma para continuar.</CardContent>
      </Card>
    </main>
  </>;
  const workspace = await getDirectorPerformanceWorkspace();

  return <>
    <DashboardHeader breadcrumb="Gestão comercial / Metas" title="Temporadas e ranking" />
    <main className="flex min-h-full flex-col gap-5 bg-background p-4 lg:p-6">
      <DirectorPerformanceManager {...workspace} />
    </main>
  </>;
}
