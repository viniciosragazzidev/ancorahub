import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { buildEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";
import type { UserDisplayInfo } from "@/shared/auth/actions";

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
      initialSidebarPathname="/dashboard"
      initialSidebarOnDuty={isSuperAdminViewingDirector}
      user={{ name, email: "fixture@ancora.example", role: "Diretor", jobTitle: "director", isPlatformAdmin: isSuperAdminViewingDirector }}
      branding={{ brandColor: null, logoUrl: null, tenantName: "\u00c2ncora Sa\u00fade" }}
      viewAs={{ canViewAs: isSuperAdminViewingDirector, viewingAs: null }}
    >
      <DirectorLiteDashboard
        data={{ ...buildEssential("today", "all", demoNow), firstName: name.split(" ")[0] ?? name }}
        period="today"
        branchId={null}
        branches={demoBranches}
        now={demoNow}
      />
    </AppShell>
  );
}
