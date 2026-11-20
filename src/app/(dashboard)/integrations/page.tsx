import { DashboardHeader } from "@/components/dashboard-header";
import { IntegrationsCatalog } from "@/features/communication-channels/components/integrations-catalog";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import litePage from "@/components/lite/page/lite-page.module.css";
import { IntegrationsCatalogLite } from "@/features/communication-channels/components/integrations-catalog-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { getIntegrationHealth } from "@/features/communication-channels/integration-health";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");

  // Chave do visual Lite: o mesmo catálogo (itens e destinos) em grade Lite.
  if (await isDirectorLitePageOnServer(context, "/integrations")) {
    // Saúde real de cada canal (ref P17): último lead e quantos nas últimas 24 h.
    const health = await getIntegrationHealth(context).catch(() => null);
    const receiving = health ? Object.values(health).filter((item) => item.state === "receiving").length : null;
    return (
      <>
        <DashboardHeader breadcrumb="Administração" title="Integrações" summary={receiving === null ? undefined : `3 canais · ${receiving} recebendo leads`} />
        <main className={litePage.stack}>
          <IntegrationsCatalogLite health={health ?? undefined} />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Integrações" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <IntegrationsCatalog />
      </main>
    </>
  );
}
