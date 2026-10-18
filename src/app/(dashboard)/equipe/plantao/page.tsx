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
    <main className="arc-venancor mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 bg-(--surface) px-4 py-6 text-(--foreground) sm:px-6 sm:py-8">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plantão da equipe</h1>
        <p className="max-w-2xl text-sm text-(--text-secondary)">Veja quem da sua equipe está no plantão hoje.</p>
      </header>
      {workspace ? <TeamOnDutyList duty={workspace.duty} /> : <p role="status" className="rounded-3xl bg-(--surface-muted) p-5 text-sm text-(--text-secondary)">Não foi possível carregar a equipe agora. Tente novamente em instantes.</p>}
    </main>
  );
}
