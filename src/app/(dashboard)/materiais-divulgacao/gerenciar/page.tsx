import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { DashboardHeader } from "@/components/dashboard-header";
import { MaterialsManager } from "@/features/promotional-materials/components/materials-manager";
import { listAllPromotionalMaterialsForAdmin } from "@/features/promotional-materials/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";

export default async function MateriaisDivulgacaoGerenciarPage() {
  const context = await getRequiredTenantContext();

  if (!hasPermission(context.role, "gerenciar_materiais_divulgacao")) {
    redirect("/access-denied");
  }

  const materials = await listAllPromotionalMaterialsForAdmin();

  return (
    <>
      <DashboardHeader breadcrumb="Materiais de Divulgação" title="Gerenciar materiais" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-primary">MARKETING</p>
          <h1 className="text-2xl font-semibold tracking-tight">Gerenciar Materiais de Divulgação</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Crie, edite e organize os materiais de divulgação disponíveis para os corretores da sua empresa.
          </p>
        </section>

        <MaterialsManager materials={materials} />
      </main>
    </>
  );
}
