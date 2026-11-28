import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
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
  // Resumo da barra do topo (anatomia de página), com o resumo que a visão geral já trouxe.
  const pageSummary = overview.state === "ready"
    ? `${overview.summary.total.toLocaleString("pt-BR")} ${overview.summary.total === 1 ? "venda acompanhada" : "vendas acompanhadas"} · ${overview.summary.documentsRequested.toLocaleString("pt-BR")} com documentos pedidos`
    : undefined;
  // Lite (28/11/2026, artifact "Comercial"): a moldura da área, com título, resumo e abas na página.
  if (lite) {
    return (
      <ComercialPage title="Venda automatizada" summary={pageSummary}>
        <AutoSaleWorkspace overview={overview} lite={lite} isDirector={context.role === "director"} />
      </ComercialPage>
    );
  }
  return (
    <>
      <DashboardHeader breadcrumb="Comercial" title="Venda Automatizada" summary={pageSummary} />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <AutoSaleWorkspace overview={overview} lite={lite} isDirector={context.role === "director"} />
      </main>
    </>
  );
}
