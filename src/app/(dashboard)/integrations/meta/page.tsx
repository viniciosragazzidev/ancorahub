import { DashboardHeader } from "@/components/dashboard-header";
import { MetaIntegrationHub } from "@/features/communication-channels/components/meta-integration-hub";
import { getMetaConnectionState } from "@/features/meta-ads/actions";
import { getMetaConversionsPanel } from "@/features/meta-ads/meta-conversion-service";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { MetaConversionsLite } from "@/features/meta-ads/components/lite/meta-conversions-lite";
import { MetaIntegrationLite } from "@/features/meta-ads/components/lite/meta-integration-lite";
import { buildMetaSyncInfo } from "@/features/meta-ads/components/lite/meta-lite-shared";
import { CAPTURE_MODE_LABEL } from "@/features/meta-ads/meta-sync-status";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCapability } from "@/shared/auth/authorization";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");
  const marketing = await getMetaConnectionState().catch((err) => {
    console.error("[MetaIntegrationPage] Failed to fetch connection state:", err);
    return {
      connection: null,
      assets: null,
      logs: [],
      isConfigured: false,
    };
  });
  const canConfigure = context.role === "director" || context.jobTitle === "marketing" || context.role === "manager";
  // Sending lead stages to Meta is a director decision; it never blocks the page.
  const conversions = context.role === "director" ? await getMetaConversionsPanel(context.tenantId) : null;

  if (await isDirectorLitePageOnServer(context, "/integrations/meta")) {
    const connection = marketing.connection;
    const connected = connection?.status === "connected";
    return (
      <>
        <DashboardHeader breadcrumb="Integrações" title="Marketing Meta" />
        <main className={litePage.stack}>
          <MetaIntegrationLite
            connection={connection}
            assets={marketing.assets}
            sync={connected && connection ? buildMetaSyncInfo(marketing.logs, connection.lastSyncedAt, canConfigure, new Date()) : null}
            captureModeLabel={connection ? CAPTURE_MODE_LABEL[connection.globalCaptureMode ?? "selective"] : null}
            canConfigure={canConfigure}
          />
          {conversions && connected ? (
            <MetaConversionsLite panel={conversions} datasets={(marketing.assets?.datasets ?? []).map(({ id, name }) => ({ id, name }))} />
          ) : null}
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="Marketing Meta" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <MetaIntegrationHub
          marketing={{ connection: marketing.connection, assets: marketing.assets, logs: marketing.logs }}
          canConfigure={canConfigure}
          conversions={conversions}
        />
      </main>
    </>
  );
}
