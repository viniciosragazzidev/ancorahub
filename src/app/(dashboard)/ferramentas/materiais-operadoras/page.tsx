import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { MaterialsWorkspace } from "@/features/operator-catalog/components/materials-workspace";
import { getCatalogOverview, getReviewQueue, listCarriersForSelect, listOperatorMaterials } from "@/features/operator-catalog/queries";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** Operator material catalog: director only (it changes what the quote assistant answers). */
export default async function MateriaisOperadorasPage() {
  const context = await getRequiredTenantContext();
  await requireCapability(context, "acessar_ferramentas");
  if (context.role !== "director") redirect("/ferramentas");

  const [materials, queue, overview, carrierOptions] = await Promise.all([
    listOperatorMaterials(context.tenantId),
    getReviewQueue(context.tenantId),
    getCatalogOverview(context.tenantId),
    listCarriersForSelect(context.tenantId),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Materiais das operadoras" />
      <main className="flex flex-1 flex-col p-(--mobile-page-padding) lg:p-6">
        <MaterialsWorkspace
          materials={materials}
          queue={queue}
          carriers={overview.carriers}
          areas={overview.areas}
          carrierOptions={carrierOptions}
          semanticSearch={overview.semanticSearch}
        />
      </main>
    </>
  );
}
