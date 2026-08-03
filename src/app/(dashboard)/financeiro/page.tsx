import { DashboardHeader } from "@/components/dashboard-header";
import { ViewScopeContext } from "@/components/ownership-context";
import { PeriodSelect } from "@/components/period-select";
import { FinancialDashboard } from "@/features/financeiro/components/financial-dashboard";
import {
  getFinancialDashboardData,
  type FinanceiroPeriod,
} from "@/features/financeiro/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const rawPeriod = (await searchParams).period;
  const period: FinanceiroPeriod =
    rawPeriod === "all" ? "all" : parsePeriod(rawPeriod);
  const data = await getFinancialDashboardData(period);

  return (
    <>
      <DashboardHeader
        breadcrumb="Área financeira"
        title="Financeiro"
        rightSlot={<PeriodSelect value={period} includeAll />}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            {/* Contexto de página legado, preservado para eventual restauração:
            <p className="text-xs font-medium text-primary">GESTÃO FINANCEIRA</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe comissões, repasses, metas financeiras e resultados da corretora.
            </p>
            */}
            <ViewScopeContext role={context.role} />
          </div>
        </section>

        <FinancialDashboard data={data} role={context.role} period={period} />
      </main>
    </>
  );
}