import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createNegotiationsFixture } from "@/features/negotiations/fixtures";
import { NegotiationsDashboard } from "@/features/negotiations/negotiations-dashboard";

type PreviewRole = "director" | "manager" | "supervisor";

function roleParam(value: string | string[] | undefined): PreviewRole {
  return value === "manager" || value === "supervisor" ? value : "director";
}

export default async function NegotiationsPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const role = roleParam(params.papel);
  const data = createNegotiationsFixture(role);
  const roleLabel = role === "director" ? "Diretora" : role === "manager" ? "Gestora" : "Supervisora";
  const rolePermissions = ["acessar_dashboard", "ver_dashboard_equipe", "acessar_leads", "acessar_clientes", "acessar_conversas", "ver_resultado_corretor"];
  const user = {
    name: `${roleLabel} de Demonstração`,
    role: role === "director" ? "Diretor" : role === "manager" ? "Gestor" : "Supervisor",
    roleKey: role,
    jobTitle: role,
    branchId: role === "manager" ? data.scope.branchId : null,
    permissions: rolePermissions,
    redirectLogout: "/login",
    isPlatformAdmin: false,
    relationshipCenterEnabled: false,
  } as const;

  return (
    <AppShell
      directorLiteEnabled
      negotiationsEnabled
      user={{ name: user.name, email: "demo@exemplo.test", role, jobTitle: role, isPlatformAdmin: false }}
      initialSidebarUser={user}
      initialSidebarPathname="/negociacoes"
      initialSidebarOnDuty={false}
      branding={{ tenantName: "Âncora Saúde", brandColor: null, logoUrl: null }}
    >
      <NegotiationsDashboard data={data} activeTab={params.aba === "estatisticas" ? "statistics" : "negotiations"} generatedAt={new Date(data.generatedAt)} />
    </AppShell>
  );
}
