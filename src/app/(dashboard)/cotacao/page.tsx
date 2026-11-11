import { redirect } from "next/navigation";

import { QuotePaused } from "@/features/broker-workspace/chat/quote-paused";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { CatalogWorkspace } from "@/features/global-catalog/pilot/catalog-workspace";
import { canUsePilot, type CatalogOptions } from "@/features/global-catalog/pilot/contracts";
import { loadPilotIndex, readPilotConfig } from "@/features/global-catalog/pilot/server";
import { CatalogQuotePage } from "@/features/global-catalog/pilot/guide/catalog-quote-page";
import { buildGuideFacets } from "@/features/global-catalog/pilot/guide/guide-facets";

/**
 * Cotação do corretor: conversa guiada sobre o catálogo real (11/11, design system Lite);
 * ?completo=1 abre a busca completa em formulário (todos os filtros de uma vez).
 */
export default async function QuoteSimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/access-denied");
  const config = await readPilotConfig();
  if (!config || !canUsePilot(context, config)) return <QuotePaused />;
  const index = await loadPilotIndex(config);
  const plans = index.plans.filter(p => !config.hiddenPlanIds.includes(p.id));
  const params = await searchParams;
  if (params.completo !== "1") {
    return <CatalogQuotePage facets={buildGuideFacets(plans, index.options, index.sourceDate)} canExport={!context.viewAs} />;
  }
  const distinct = (key: "administrator" | "accommodation" | "coparticipation" | "coverage" | "entity") => [...new Set(plans.map(p => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const options: CatalogOptions = { ...index.options, operators: [...new Map(plans.map(p => [p.operatorId, { value: p.operatorId, label: p.operator }])).values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), administrators: distinct("administrator"), accommodations: distinct("accommodation"), coparticipations: distinct("coparticipation"), coverages: distinct("coverage"), entities: distinct("entity") };
  return <CatalogWorkspace options={options} counts={index.counts} sourceDate={index.sourceDate} />;
}
