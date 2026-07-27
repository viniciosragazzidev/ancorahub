import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { MaterialsPublicPage } from "@/features/promotional-materials/components/materials-public-page";
import { listPromotionalMaterials } from "@/features/promotional-materials/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";

export default async function MateriaisDivulgacaoPage() {
  const context = await getRequiredTenantContext();

  if (!hasPermission(context.role, "acessar_materiais_divulgacao")) {
    redirect("/access-denied");
  }

  const materials = await listPromotionalMaterials({ active: true });
  const canManage = hasPermission(context.role, "gerenciar_materiais_divulgacao");

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação"
        title="Materiais de Divulgação"
        rightSlot={
          canManage ? (
            <Button render={<Link href="/materiais-divulgacao/gerenciar" />} size="sm" variant="outline">
              Gerenciar materiais
            </Button>
          ) : undefined
        }
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <MaterialsPublicPage materials={materials} />
      </main>
    </>
  );
}
