import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Target } from "@/components/huge-icons";
import { ViewScopeContext } from "@/components/ownership-context";
import { Button } from "@/components/ui/button";
import { GoalsManager } from "@/features/goals/components/goals-manager";
import {
  getGoals,
  getTeamMembers,
  getBranches,
} from "@/features/goals/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import Link from "next/link";

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
      <DashboardHeader
        breadcrumb="Gestão comercial"
        title="Metas"
        rightSlot={context.role === "director" ? <Button render={<Link href="/metas/desempenho" />} size="sm"><Target className="size-4" /> Temporadas e ranking</Button> : undefined}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div>
          {/* Contexto de página legado, preservado para eventual restauração:
          <p className="text-xs font-medium text-primary">GESTÃO COMERCIAL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Metas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina e acompanhe metas comerciais por corretor, equipe, filial ou corretora.
            O progresso é calculado automaticamente com base nos dados reais de vendas e atendimento.
          </p>
          */}
          <ViewScopeContext role={context.role} />
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
