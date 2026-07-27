import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { ViewScopeContext } from "@/components/ownership-context";
import { GoalsManager } from "@/features/goals/components/goals-manager";
import {
  getGoals,
  getTeamMembers,
  getBranches,
} from "@/features/goals/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";

export default async function GoalsPage() {
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "gerenciar_metas")) redirect("/access-denied");

  const [goals, teamMembers, branches] = await Promise.all([
    getGoals(),
    getTeamMembers(),
    getBranches(),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Gestão comercial" title="Metas" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">GESTÃO COMERCIAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Metas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina e acompanhe metas comerciais por corretor, equipe, filial ou corretora.
              O progresso é calculado automaticamente com base nos dados reais de vendas e atendimento.
            </p>
            <div className="mt-3"><ViewScopeContext role={context.role} /></div>
          </div>
        </div>

        <GoalsManager
          goals={goals}
          teamMembers={teamMembers}
          branches={branches}
        />
      </main>
    </>
  );
}
