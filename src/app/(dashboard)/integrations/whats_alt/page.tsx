import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getSystemSetting } from "@/features/system-settings/queries";
import { listOwnWahaConnections } from "@/features/waha-cadence/connection-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { WahaConnectionsCard } from "../../settings/_components/waha-connections-card";

export const dynamic = "force-dynamic";

/**
 * WAHA is intentionally exposed in its own route. The official Meta route
 * must remain limited to Meta Cloud configuration and templates.
 */
export default async function WhatsAltIntegrationPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/integrations");

  const enabled = (await getSystemSetting("feature_waha_connections_enabled")) === "true";
  const connections = enabled ? await listOwnWahaConnections().catch(() => []) : [];

  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="WhatsApp Alternativo" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Alternativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canal independente via WAHA para conexões e comunicações operacionais. Ele não compartilha configuração ou envio com a API Oficial Meta.
          </p>
        </div>
        <WahaConnectionsCard connections={connections} enabled={enabled} role={context.role} internalNotificationPolicy={null} />
      </main>
    </>
  );
}
