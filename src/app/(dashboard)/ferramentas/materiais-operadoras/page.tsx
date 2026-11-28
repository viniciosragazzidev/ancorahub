import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import compat from "@/components/lite/page/lite-compat.module.css";
import litePage from "@/components/lite/page/lite-page.module.css";
import { MaterialsWorkspace } from "@/features/operator-catalog/components/materials-workspace";
import { getCatalogOverview, getReviewQueue, listCarriersForSelect, listOperatorMaterials } from "@/features/operator-catalog/queries";
import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

const count = (value: number, one: string, many: string) => `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;

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
  // Resumo do topo (anatomia de página), só com o que a página já carrega.
  const toReview = queue.pendingFacts.length;
  const summary = [
    count(overview.carriers.length, "operadora", "operadoras"),
    count(materials.length, "material", "materiais"),
    toReview > 0 ? `${toReview.toLocaleString("pt-BR")} para revisar` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Materiais das operadoras" summary={summary} />
      {/* Direção limpa (28/11/2026): moldura Lite, sem sombra, alvos de 44px e cartões de borda. */}
      <main className={litePage.stack}>
        <div className={compat.compat}>
        <MaterialsWorkspace
          materials={materials}
          queue={queue}
          carriers={overview.carriers}
          areas={overview.areas}
          carrierOptions={carrierOptions}
          semanticSearch={overview.semanticSearch}
        />
        </div>
      </main>
    </>
  );
}
