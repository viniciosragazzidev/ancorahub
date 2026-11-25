import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { SupervisorControlPanel } from "@/features/supervisor-workspace/supervisor-control-panel";
import { getSupervisorControlData } from "@/features/supervisor-workspace/control-queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function SupervisorControlRoute() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor" || !isLightRouteAllowed("/equipe/controle", "supervisor")) redirect("/access-denied");
  const data = await getSupervisorControlData(context).catch(() => null);
  if (!data) return <section className="arc-venancor min-h-full bg-(--surface) px-4 py-8 text-(--foreground)" role="status"><div className="mx-auto max-w-3xl rounded-2xl bg-(--surface-muted) p-5"><h1 className="text-lg font-medium">Controle indisponível</h1><p className="mt-2 text-sm text-(--text-muted)">Não foi possível carregar os dados da equipe agora. Tente novamente em instantes.</p></div></section>;
  return <SupervisorControlPanel initialData={data} />;
}
