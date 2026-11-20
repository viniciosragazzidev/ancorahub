import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { listTeams } from "@/features/team/teams-overview";
import type { TenantContext } from "@/shared/auth/tenant-context";

import { TeamTabsLite } from "./_components/team-lite";
import { TeamsListLite } from "./_components/teams-lite";
import { TeamManagementTabs } from "./team-management-tabs";

/** Aba Equipes de /equipe (16/11/2026): uma linha por supervisora, com os números da equipe dela. */
export async function TeamsView({ context }: { context: TenantContext }) {
  const teams = await listTeams(context);
  const lite = await isDirectorLitePageOnServer(context, "/equipe");
  const brokerCount = teams.reduce((total, team) => total + team.brokers, 0);
  const summary = `${teams.length.toLocaleString("pt-BR")} ${teams.length === 1 ? "equipe" : "equipes"} · ${brokerCount.toLocaleString("pt-BR")} ${brokerCount === 1 ? "corretor" : "corretores"}`;
  return (
    <>
      <DashboardHeader breadcrumb="Gestão" title="Equipe e unidades" summary={summary} />
      <main className={lite ? litePage.stack : "flex min-h-full flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6"}>
        <div className={`arc-venancor ${litePage.stack}`} data-skin="diretor">
          {lite ? <TeamTabsLite active="equipes" /> : <TeamManagementTabs active="equipes" counts={{ equipes: teams.length }} />}
          <TeamsListLite teams={teams} />
        </div>
      </main>
    </>
  );
}
