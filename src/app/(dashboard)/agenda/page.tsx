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
    <main className="arc-venancor mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 bg-(--surface) px-4 py-6 text-(--foreground) sm:px-6 sm:py-8">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Agenda</h1>
        <p className="max-w-2xl text-sm text-(--text-secondary)">Acompanhe seus retornos e escolha o próximo passo com cada cliente.</p>
      </header>
      <Agenda items={data.agenda} maxItems={null} interactive heading="Seus retornos" />
    </main>
  );
}
