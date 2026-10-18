import { redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { teamInternal, teamLeaderboard } from "@/features/engagement/leaderboard-queries";
import { TeamStandings } from "@/features/journey/components/team-standings";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** Supervisor Lite: the team's board and, with the team ranking on, the board between teams of the unit. */
export default async function TeamPerformancePage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor") redirect("/dashboard");
  const enabled = (await getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false")) === "true";
  if (!enabled) redirect("/equipe/minha");

  const [internal, teams] = await Promise.all([
    teamInternal(context.tenantId, context.userId, new Date(), context.userId).catch(() => null),
    context.branchId ? teamLeaderboard(context.tenantId, context.branchId).catch(() => null) : Promise.resolve(null),
  ]);
  return <TeamStandings data={{ supervisorId: context.userId, internal, teams }} />;
}
