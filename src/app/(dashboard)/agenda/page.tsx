import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { Agenda } from "@/features/broker-workspace/components/light-dashboard/agenda";
import { ConnectedAgenda, ConnectedAgendaError } from "@/features/broker-workspace/components/light-dashboard/connected-agenda";
import { agendaDutyLine } from "@/features/broker-workspace/agenda-connected";
import { getBrokerAgendaEntries } from "@/features/broker-workspace/agenda-connected-queries";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

export const dynamic = "force-dynamic";

/** Agenda conectada (Etapa 6 do plano do modo corretor), atrás da chave do Início reorganizado. */
async function ConnectedAgendaPage({ context }: { context: TenantContext }) {
  const now = new Date();
  // O plantão é só um atalho: se a leitura falhar, a agenda aparece sem ele (sem afirmar que não há plantão).
  const [entries, workspace] = await Promise.allSettled([getBrokerAgendaEntries(context), getCachedBrokerWorkspaceData()]);
  const duty = workspace.status === "fulfilled" ? agendaDutyLine(workspace.value.duty, now) : null;
  if (entries.status === "rejected") console.error("[agenda] leitura falhou", entries.reason);
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">Agenda</h1>
        <p className="lite-page-subtitle">Retornos, tarefas e renovações por dia. Toque em um item para abrir o lead ou o perfil do cliente.</p>
      </header>
      {entries.status === "fulfilled"
        ? <ConnectedAgenda entries={entries.value} duty={duty} generatedAt={now.toISOString()} />
        : <ConnectedAgendaError />}
    </main>
  );
}

export default async function BrokerAgendaPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || (await getLiteAudience(context)) !== "broker" || !isLightRouteAllowed("/agenda", "broker")) redirect("/dashboard");

  const reorg = await getFeatureFlag(FEATURE_FLAGS.BROKER_NAV_REORG).catch(() => FEATURE_FLAGS.BROKER_NAV_REORG.defaultValue);
  if (reorg === "true") return <ConnectedAgendaPage context={context} />;

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
