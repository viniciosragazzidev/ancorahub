import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { CommissionRulesManager } from "@/features/commissions/components/commission-rules-manager";
import { getCommissionRules, getCarrierOptions } from "@/features/commissions/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getPostSaleSettings } from "@/features/post-sale/queries";
import { PostSaleSettings } from "@/features/post-sale/components/post-sale-settings";

export default async function CommissionRulesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");

  const [rules, carriers, postSaleSettings] = await Promise.all([
    getCommissionRules(),
    getCarrierOptions(),
    getPostSaleSettings(),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Configurações / Financeiro" title="Regras de Comissão" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">CONFIGURAÇÃO FINANCEIRA</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Regras de Comissão</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina como os corretores serão comissionados — única ou escalonada — por operadora ou plano.
              As regras ativas são aplicadas automaticamente ao converter um lead em venda.
            </p>
          </div>
        </div>

        <CommissionRulesManager rules={rules} carriers={carriers} />
        <PostSaleSettings {...postSaleSettings} />
      </main>
    </>
  );
}
