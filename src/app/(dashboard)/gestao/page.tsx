import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerUnitIdentity } from "@/features/manager-workspace/gestao-overview-queries";
import { resolveGestaoAccess } from "@/features/team-management-ui/access";
import { buildUnitOverview } from "@/features/team-management-ui/build-overview";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { loadTeamPage } from "@/features/team-management-ui/team-page-loader";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function GestaoPage() {
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  const decision = resolveGestaoAccess({ flagOn: await isTeamManagementEnabled(), role: context.role, audience });
  if (decision === "off") notFound();
  if (decision === "supervisor") {
    // Supervisor Lite: a própria equipe, a mesma tela do perfil da equipe (G2).
    const page = await loadTeamPage({ context, audience, flagOn: true, requestedSupervisorId: context.userId });
    if (page.access !== "render") redirect("/equipe/minha");
    return <TeamPageViewComponent view={page.view} />;
  }
  if (decision === "denied") redirect("/access-denied");

  const identity = await getManagerUnitIdentity(context);
  // TODO(G0): trocar `metrics: null` pela camada de métricas do Cinzel (src/features/team-management/metrics.ts),
  // com janela atual e anterior por supervisor. Até lá a tela mostra estrutura e "Indicadores em breve".
  const overview = buildUnitOverview({ ...identity, metrics: null });

  return <UnitOverviewView overview={overview} />;
}
