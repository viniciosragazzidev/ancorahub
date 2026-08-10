import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { CotadorViewerClient } from "./cotador-viewer-client";

export default async function CotacaoPage() {
  await getRequiredTenantContext();

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas de Vendas" title="Cotação de Saúde" />
      <main className="flex min-h-full flex-col gap-5 bg-background p-4 lg:p-6">
        <CotadorViewerClient />
      </main>
    </>
  );
}
