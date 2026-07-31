import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { MetaIntegrationView } from "@/features/meta-ads/components/meta-integration-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";

export const dynamic = "force-dynamic";

export default async function MetaSettingsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");

  const state = await getMetaConnectionState();

  return (
    <>
      <DashboardHeader breadcrumb="Configurações / Integrações" title="Meta Business & Ads" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <MetaIntegrationView connection={state.connection} logs={state.logs} />
      </main>
    </>
  );
}
