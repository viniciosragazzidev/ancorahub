import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { BrokerGoalView } from "@/features/goals/components/broker-goal-view";
import { getBrokerGoal } from "@/features/goals/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export default async function BrokerGoalPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/metas");

  const goal = await getBrokerGoal();

  return (
    <>
      <DashboardHeader breadcrumb="Meu desempenho" title="Minha meta" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">MEU DESEMPENHO</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Minha meta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe seu progresso comercial e os resultados acumulados no período atual.
            </p>
          </div>
        </div>

        <BrokerGoalView goal={goal} />
      </main>
    </>
  );
}
