import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { MetaIntegrationView } from "@/features/meta-ads/components/meta-integration-view";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function MetaSettingsPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/settings");

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
