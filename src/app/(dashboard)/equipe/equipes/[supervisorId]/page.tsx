import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isTeamMemberProfileEnabled } from "@/features/team/member-profile";
import { canSeeTeams, getTeamDetail } from "@/features/team/teams-overview";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { TeamDetailLite } from "../../_components/teams-lite";

const TABS = ["corretores", "empresa", "lista"] as const;

/** Página de uma equipe (16/11/2026): supervisora, corretores e os leads da empresa e da lista importada. */
export default async function TeamPage({ params, searchParams }: { params: Promise<{ supervisorId: string }>; searchParams: Promise<{ aba?: string }> }) {
  const context = await getRequiredTenantContext();
  if (!canSeeTeams(context)) redirect("/access-denied");
  const [{ supervisorId }, { aba }] = await Promise.all([params, searchParams]);
  const [detail, canViewProfile] = await Promise.all([getTeamDetail(context, decodeURIComponent(supervisorId)), isTeamMemberProfileEnabled()]);
  if (!detail) notFound();
  const tab = TABS.find((value) => value === aba) ?? "corretores";
  return (
    <>
      <DashboardHeader
        breadcrumb="Equipes"
        title={detail.team.name}
      />
      <main className={litePage.stack}>
        <div className={`arc-venancor ${litePage.stack}`} data-skin="diretor">
          <Link href="/equipe?visao=equipes" className={litePage.button}>Todas as equipes</Link>
          <TeamDetailLite detail={detail} tab={tab} canViewProfile={canViewProfile} />
        </div>
      </main>
    </>
  );
}
