import { DashboardHeader } from "@/components/dashboard-header";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
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

/** Resumo de uma linha do topo, só com o que a página já carregou (skill `interface-enxuta`). */
function buildMetaSummary(connected: boolean, assets: { pages: unknown[]; adAccounts: unknown[] } | null) {
  if (!connected) return "Não conectada";
  const pages = assets?.pages.length ?? 0;
  const accounts = assets?.adAccounts.length ?? 0;
  return `Conectada · ${pages.toLocaleString("pt-BR")} ${pages === 1 ? "página" : "páginas"} · ${accounts.toLocaleString("pt-BR")} ${accounts === 1 ? "conta de anúncio" : "contas de anúncio"}`;
}

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
  const summary = buildMetaSummary(marketing.connection?.status === "connected", marketing.assets);

  if (await isDirectorLitePageOnServer(context, "/integrations/meta")) {
    const connection = marketing.connection;
    const connected = connection?.status === "connected";
    return (
      <ComercialPage title="Meta" summary={summary}>
        <div className={litePage.stack} style={{ padding: 0 }}>
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
        </div>
      </ComercialPage>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="Marketing Meta" summary={summary} />
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
