import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerUnitIdentity } from "@/features/manager-workspace/gestao-overview-queries";
import { getTeamMetrics } from "@/features/team-management/metrics";
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

  const now = new Date();
  const [identity, teamMetrics] = await Promise.all([
    getManagerUnitIdentity(context),
    getTeamMetrics(context, { window: 7, now }),
  ]);
  const overview = buildUnitOverview({
    ...identity,
    now,
    metrics: {
      unit: teamMetrics.unit,
      unitConversionRate: teamMetrics.unitConversionRate,
      teamsBySupervisorId: new Map(teamMetrics.teams
        .filter((team) => team.supervisorId !== null)
        .map((team) => [team.supervisorId!, team])),
      unassignedTeam: teamMetrics.teams.find((team) => team.supervisorId === null) ?? null,
    },
  });

  return <UnitOverviewView overview={overview} />;
}
