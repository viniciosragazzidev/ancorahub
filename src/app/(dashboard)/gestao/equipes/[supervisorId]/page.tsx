import { notFound, redirect } from "next/navigation";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import { loadTeamPage } from "@/features/team-management-ui/team-page-loader";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { TeamExtrasSection } from "@/features/team-management-extras/team-extras-section";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { deriveUnitContext, findSupervisorBranch } from "@/features/team-management-ui/director-unit-context";

export const dynamic = "force-dynamic";

export default async function GestaoEquipePage({ params }: { params: Promise<{ supervisorId: string }> }) {
  const context = await getRequiredTenantContext();
  const { supervisorId } = await params;
  const audience = await getLiteAudience(context);
  const flagOn = await isTeamManagementEnabled();

  // Diretor com o Lite: a equipe abre no contexto de gestor da unidade dela (mesmas regras de escopo do gestor).
  if (context.role === "director" && flagOn && await isDirectorLitePageOnServer(context, "/gestao/equipes/[supervisorId]")) {
    const branchId = await findSupervisorBranch(context, supervisorId);
    if (!branchId) notFound();
    const unitContext = deriveUnitContext(context, branchId);
    const page = await loadTeamPage({ context: unitContext, audience: "manager", flagOn, requestedSupervisorId: supervisorId });
    if (page.access !== "render" || !page.view) notFound();
    return (
      <>
        <DashboardHeader breadcrumb="Gestão de equipe" title={page.view.teamName} />
        <main className={litePage.stack}>
          <TeamPageViewComponent view={page.view} embedded />
          <TeamExtrasSection context={unitContext} supervisorId={supervisorId} canEditBrokers={false} />
        </main>
      </>
    );
  }

  const page = await loadTeamPage({ context, audience, flagOn, requestedSupervisorId: supervisorId });
  if (page.access === "off" || page.access === "notFound") notFound();
  if (page.access === "denied" || !page.view) redirect("/access-denied");

  return (
    <>
      <TeamPageViewComponent view={page.view} />
      <TeamExtrasSection context={context} supervisorId={supervisorId} canEditBrokers={audience === "supervisor"} />
    </>
  );
}
