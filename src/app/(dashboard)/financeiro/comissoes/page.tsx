import { DashboardHeader } from "@/components/dashboard-header";
import { CommissionDetails } from "@/features/financeiro/components/commission-details";
import { getCommissionDetailsData } from "@/features/financeiro/queries/commission-details";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function CommissionDetailsPage() {
  const context = await getRequiredTenantContext();
  const data = await getCommissionDetailsData();

  return (
    <>
      <DashboardHeader breadcrumb="Financeiro / Comissões" title="Comissões" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">FINANCEIRO</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Comissões</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe todas as comissões geradas por venda, consolidadas por corretor,
              com cronograma de repasses e status de pagamento.
            </p>
          </div>
        </div>

        <CommissionDetails data={data} role={context.role} />
      </main>
    </>
  );
}
