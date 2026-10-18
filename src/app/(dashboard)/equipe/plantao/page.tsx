import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { TeamOnDutyList } from "@/features/supervisor-workspace/team-on-duty-list";
import { getSupervisorWorkspaceData } from "@/features/supervisor-workspace/queries";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function SupervisorDutyPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor" || !isLightRouteAllowed("/equipe/plantao", "supervisor")) redirect("/dashboard");

  const workspace = await getSupervisorWorkspaceData(context).catch(() => null);
  return (
    <main className="arc-venancor lite-page flex min-h-full flex-col gap-5 bg-(--surface) text-(--foreground)">
      <header>
        <h1 className="lite-page-title">Plantão da equipe</h1>
        <p className="lite-page-subtitle">Veja quem da sua equipe está no plantão hoje.</p>
      </header>
      {workspace ? <TeamOnDutyList duty={workspace.duty} /> : <p role="status" className="rounded-3xl bg-(--surface-muted) p-5 text-sm text-(--text-secondary)">Não foi possível carregar a equipe agora. Tente novamente em instantes.</p>}
    </main>
  );
}
