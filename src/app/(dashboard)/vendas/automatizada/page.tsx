import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { readAutoSaleFlags } from "@/features/auto-sale/flag";
import { getAutoSaleOverview } from "@/features/auto-sale/queries";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { AutoSaleWorkspace } from "./_components/auto-sale-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venda Automatizada - Comercial" };

/**
 * Venda Automatizada (piloto, DEC-182): o diretor escolhe um lead quente por vez e a assistente virtual
 * conduz a venda em Simulação ou Copiloto. Só aparece com `feature_auto_sale_<tenantId>` ligada.
 * O layout de /vendas já tira o gestor da versão antiga (fail closed).
 */
export default async function AutoSalePage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");
  const flags = await readAutoSaleFlags(context.tenantId);
  if (!flags.enabled) notFound();
  const overview = await getAutoSaleOverview(context);
  const lite = await isDirectorLitePageOnServer(context, "/vendas/automatizada");
  return (
    <>
      <DashboardHeader breadcrumb="Comercial" title="Venda Automatizada" />
      <main className={lite ? litePage.stack : "flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6"}>
        <AutoSaleWorkspace overview={overview} lite={lite} isDirector={context.role === "director"} />
      </main>
    </>
  );
}
