import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerUnitIdentity } from "@/features/manager-workspace/gestao-overview-queries";
import { resolveGestaoAccess } from "@/features/team-management-ui/access";
import { buildUnitOverview } from "@/features/team-management-ui/build-overview";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function GestaoPage() {
  const context = await getRequiredTenantContext();
  const audience = await getLiteAudience(context);
  const decision = resolveGestaoAccess({ flagOn: await isTeamManagementEnabled(), role: context.role, audience });
  if (decision === "off") notFound();
  if (decision === "supervisor") redirect("/equipe/minha");
  if (decision === "denied") redirect("/access-denied");

  const identity = await getManagerUnitIdentity(context);
  // TODO(G0): trocar `metrics: null` pela camada de métricas do Cinzel (src/features/team-management/metrics.ts),
  // com janela atual e anterior por supervisor. Até lá a tela mostra estrutura e "Indicadores em breve".
  const overview = buildUnitOverview({ ...identity, metrics: null });

  return <UnitOverviewView overview={overview} />;
}
