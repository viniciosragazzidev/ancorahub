import { DashboardHeader } from "@/components/dashboard-header";
import { MetaIntegrationHub } from "@/features/communication-channels/components/meta-integration-hub";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");
  const marketing = await getMetaConnectionState();
  const canConfigure = context.role === "director" || context.jobTitle === "marketing" || context.role === "manager";

  return <>
    <DashboardHeader breadcrumb="Integrações" title="Marketing Meta" />
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:p-6">
      <MetaIntegrationHub marketing={{ connection: marketing.connection, assets: marketing.assets, logs: marketing.logs }} canConfigure={canConfigure} />
    </main>
  </>;
}
