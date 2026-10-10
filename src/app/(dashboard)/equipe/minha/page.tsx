import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { MyTeamPage } from "@/features/supervisor-workspace/my-team-page";
import { getSupervisorTeamPageData } from "@/features/supervisor-workspace/my-team-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function MySupervisorTeamRoute() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor" || !isLightRouteAllowed("/equipe/minha", "supervisor")) redirect("/access-denied");
  const data = await getSupervisorTeamPageData().catch(() => null);
  if (!data) {
    return <section className="arc-venancor min-h-full bg-[var(--surface)] px-4 py-8 text-[var(--foreground)]" aria-labelledby="team-unavailable-title"><div className="mx-auto max-w-3xl rounded-[var(--radius-panel)] bg-[var(--surface-muted)] p-5" role="status"><h1 id="team-unavailable-title" className="text-lg font-medium">Minha equipe está indisponível</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Não foi possível abrir sua equipe agora. Tente de novo em instantes.</p></div></section>;
  }
  return <MyTeamPage initialData={data} />;
}
