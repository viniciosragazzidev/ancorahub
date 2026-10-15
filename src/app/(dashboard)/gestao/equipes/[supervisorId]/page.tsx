import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { loadTeamPage } from "@/features/team-management-ui/team-page-loader";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { TeamExtrasSection } from "@/features/team-management-extras/team-extras-section";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function GestaoEquipePage({ params }: { params: Promise<{ supervisorId: string }> }) {
  const context = await getRequiredTenantContext();
  const { supervisorId } = await params;
  const audience = await getLiteAudience(context);
  const page = await loadTeamPage({ context, audience, flagOn: await isTeamManagementEnabled(), requestedSupervisorId: supervisorId });
  if (page.access === "off" || page.access === "notFound") notFound();
  if (page.access === "denied" || !page.view) redirect("/access-denied");

  return (
    <>
      <TeamPageViewComponent view={page.view} />
      <TeamExtrasSection context={context} supervisorId={supervisorId} canEditBrokers={audience === "supervisor"} />
    </>
  );
}
