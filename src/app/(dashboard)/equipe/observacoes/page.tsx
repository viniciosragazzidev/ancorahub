import { redirect } from "next/navigation";

import { isLightRouteAllowed } from "@/components/light/light-routes";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getSupervisorObservationPage } from "@/features/supervisor-workspace/observation-queries";
import { SupervisorObservationsList } from "@/features/supervisor-workspace/observations-list";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

export default async function SupervisorObservationsPage({ searchParams }: { searchParams: Promise<{ corretor?: string; etapa?: string; beforeAt?: string; beforeId?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || (await getLiteAudience(context)) !== "supervisor" || !isLightRouteAllowed("/equipe/observacoes", "supervisor")) redirect("/dashboard");
  const params = await searchParams;
  const data = await getSupervisorObservationPage(context, { brokerId: params.corretor, stage: params.etapa, beforeAt: params.beforeAt, beforeId: params.beforeId });
  if (!data) redirect("/dashboard");
  return <SupervisorObservationsList data={data} brokerId={params.corretor ?? ""} stage={params.etapa ?? ""} />;
}
