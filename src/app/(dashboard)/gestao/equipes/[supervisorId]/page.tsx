import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getTeamGoalsView } from "@/features/goals/lite-goals-queries";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { loadTeamPage } from "@/features/team-management-ui/team-page-loader";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { GoalsSection } from "@/features/team-management-extras/goals-section";
import { InsightsSection } from "@/features/team-management-extras/insights-section";
import { getTeamInsights } from "@/features/team-management-extras/team-insights";
import styles from "@/features/team-management-extras/team-extras.module.css";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function GestaoEquipePage({ params }: { params: Promise<{ supervisorId: string }> }) {
  const context = await getRequiredTenantContext();
  const { supervisorId } = await params;
  const audience = await getLiteAudience(context);
  const page = await loadTeamPage({ context, audience, flagOn: await isTeamManagementEnabled(), requestedSupervisorId: supervisorId });
  if (page.access === "off" || page.access === "notFound") notFound();
  if (page.access === "denied" || !page.view) redirect("/access-denied");

  const now = new Date();
  const [insights, goals] = await Promise.all([
    getTeamInsights({ context, supervisorId, now }),
    getTeamGoalsView({ context, supervisorId, now }),
  ]);

  return (
    <>
      <TeamPageViewComponent view={page.view} />
      <div className={styles.extras}>
        <InsightsSection insights={insights} />
        <GoalsSection supervisorId={supervisorId} view={goals} canEditTeam canEditBrokers={audience === "supervisor"} />
      </div>
    </>
  );
}
