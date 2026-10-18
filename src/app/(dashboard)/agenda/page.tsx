import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { Agenda } from "@/features/broker-workspace/components/light-dashboard/agenda";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function BrokerAgendaPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || (await getLiteAudience(context)) !== "broker" || !isLightRouteAllowed("/agenda", "broker")) redirect("/dashboard");

  const data = await getBrokerWorkspaceData();
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">Agenda</h1>
        <p className="lite-page-subtitle">Acompanhe seus retornos e escolha o próximo passo com cada cliente.</p>
      </header>
      <Agenda items={data.agenda} maxItems={null} interactive heading="Seus retornos" />
    </main>
  );
}
