import { DashboardHeader } from "@/components/dashboard-header";
import { ViewScopeContext } from "@/components/ownership-context";
import { FinancialDashboard } from "@/features/financeiro/components/financial-dashboard";
import { getFinancialDashboardData } from "@/features/financeiro/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function FinancialPage() {
  const context = await getRequiredTenantContext();
  const data = await getFinancialDashboardData();

  return (
    <>
      <DashboardHeader breadcrumb="Área financeira" title="Financeiro" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">GESTÃO FINANCEIRA</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe comissões, repasses, metas financeiras e resultados da corretora.
            </p>
            <div className="mt-3"><ViewScopeContext role={context.role} /></div>
          </div>
        </section>

        <FinancialDashboard data={data} role={context.role} />
      </main>
    </>
  );
}
