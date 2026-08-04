import { DashboardHeader } from "@/components/dashboard-header";
import { MetaManualIntegrationWorkspace } from "@/features/communication-channels/components/meta-manual-integration-workspace";
import { getManualMetaIntegrationWorkspaceData } from "@/features/communication-channels/manual-meta-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";

export const dynamic = "force-dynamic";

export default async function MetaSettingsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");
  const workspace = await getManualMetaIntegrationWorkspaceData(context);

  return (
    <>
      <DashboardHeader breadcrumb="Configurações / Integrações" title="Integração Meta" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <MetaManualIntegrationWorkspace {...workspace} />
      </main>
    </>
  );
}
