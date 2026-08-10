import { DashboardHeader } from "@/components/dashboard-header";
import { IntegrationsCatalog } from "@/features/communication-channels/components/integrations-catalog";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Integrações" />
      <main className="flex flex-1 flex-col p-4 lg:p-6">
        <IntegrationsCatalog />
      </main>
    </>
  );
}
