import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { buildEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";
import type { UserDisplayInfo } from "@/shared/auth/actions";
import { DashboardHeader } from "@/components/dashboard-header";
import liteStyles from "@/app/(dashboard)/leads/leads-lite-page.module.css";
import { LeadDetailFixture } from "@/app/dev/diretor-lead-real/lead-detail-fixture";

import { LeadsShellScreen } from "./leads-screen";

const permissions = [
  "acessar_dashboard",
  "acessar_conversas",
  "acessar_leads",
  "acessar_qualificacao_ia",
  "acessar_vendas",
  "convidar_corretor",
  "acessar_configuracoes_pessoais",
  "acessar_campanhas_meta",
  "acessar_ferramentas",
];

const demoNow = new Date("2026-10-24T16:42:00.000Z");
const demoBranches = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-norte", name: "Zona Norte" },
];

export default async function DirectorShellRealPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const isSuperAdminViewingDirector = params.case === "super-admin";
  // ?tela=dashboard (padrão), leads, kanban, qualificacao, sem-atribuicao, radar ou lead: a mesma moldura real com cada tela.
  const screen = typeof params.tela === "string" ? params.tela : "dashboard";
  const leadsViews: Record<string, "list" | "kanban" | "qualificacoes" | "sem-atribuicao" | "radar"> = { leads: "list", kanban: "kanban", qualificacao: "qualificacoes", "sem-atribuicao": "sem-atribuicao", radar: "radar" };
  const leadsView = leadsViews[screen];
  const pathname = leadsView ? "/leads" : screen === "lead" ? "/leads/11111111-1111-4111-8111-111111111111" : "/dashboard";
  const name = isSuperAdminViewingDirector ? "Alex Exemplo" : "Marina Exemplo";
  const previewUser: UserDisplayInfo = {
    name,
    role: "Diretor",
    roleKey: "director",
    jobTitle: "director",
    permissions,
    redirectLogout: "/dashboard",
    isPlatformAdmin: isSuperAdminViewingDirector,
    activeRoleOverride: isSuperAdminViewingDirector ? "director" : null,
    userProfileEnabled: true,
    relationshipCenterEnabled: true,
  };

  return (
    <AppShell
      directorLiteEnabled
      initialSidebarUser={previewUser}
      initialSidebarPathname={pathname}
      initialSidebarOnDuty={isSuperAdminViewingDirector}
      user={{ name, email: "fixture@ancora.example", role: "Diretor", jobTitle: "director", isPlatformAdmin: isSuperAdminViewingDirector }}
      branding={{ brandColor: null, logoUrl: null, tenantName: "\u00c2ncora Sa\u00fade" }}
      viewAs={{ canViewAs: isSuperAdminViewingDirector, viewingAs: null }}
    >
      {leadsView ? (
        <LeadsShellScreen view={leadsView} />
      ) : screen === "lead" ? (
        <>
          <DashboardHeader breadcrumb="Operação comercial" title="Perfil do lead" />
          <main className={liteStyles.page}>
            <LeadDetailFixture />
          </main>
        </>
      ) : (
        <DirectorLiteDashboard
          data={{ ...buildEssential("today", "all", demoNow), firstName: name.split(" ")[0] ?? name }}
          period="today"
          branchId={null}
          branches={demoBranches}
          now={demoNow}
        />
      )}
    </AppShell>
  );
}
