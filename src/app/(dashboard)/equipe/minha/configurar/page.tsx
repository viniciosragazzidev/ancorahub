import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { SupervisorTeamSettings } from "@/features/supervisor-workspace/team-settings";
import { getSupervisorTeamPageData } from "@/features/supervisor-workspace/my-team-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function SupervisorTeamSettingsRoute() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor" || !isLightRouteAllowed("/equipe/minha/configurar", "supervisor")) redirect("/access-denied");
  const data = await getSupervisorTeamPageData().catch(() => null);
  if (!data) return <section className="arc-venancor mx-auto max-w-xl p-5 text-[var(--foreground)]" role="status"><h1 className="font-semibold">Configuração indisponível</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Não foi possível carregar o perfil da equipe. Tente novamente.</p></section>;
  return <SupervisorTeamSettings initialTeam={data.team} />;
}
