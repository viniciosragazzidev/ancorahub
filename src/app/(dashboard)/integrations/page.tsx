import { DashboardHeader } from "@/components/dashboard-header";
import { IntegrationsCatalog } from "@/features/communication-channels/components/integrations-catalog";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import litePage from "@/components/lite/page/lite-page.module.css";
import { IntegrationsCatalogLite } from "@/features/communication-channels/components/integrations-catalog-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_integracao_meta");

  // Chave do visual Lite: o mesmo catálogo (itens e destinos) em grade Lite.
  if (await isDirectorLitePageOnServer(context.role, context.tenantId, "/integrations")) {
    return (
      <>
        <DashboardHeader breadcrumb="Administração" title="Integrações" />
        <main className={litePage.stack}>
          <IntegrationsCatalogLite />
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
