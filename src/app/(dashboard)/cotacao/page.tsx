import { redirect } from "next/navigation";

import { QuotePaused } from "@/features/broker-workspace/chat/quote-paused";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { CatalogWorkspace } from "@/features/global-catalog/pilot/catalog-workspace";
import { CotacaoLiteWorkspace } from "@/features/global-catalog/pilot/cotacao-lite/cotacao-lite-workspace";
import { canUsePilot, type CatalogOptions } from "@/features/global-catalog/pilot/contracts";
import { loadPilotIndex, readPilotConfig } from "@/features/global-catalog/pilot/server";

/**
 * Cotação no fluxo guiado Lite (passos, um campo por vez). ?completo=1 abre o formulário completo
 * como fallback (filtros avançados, rede e comparação no formato antigo).
 */
export default async function QuoteSimulatorPage({ searchParams }: { searchParams: Promise<{ completo?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/access-denied");
  const config = await readPilotConfig();
  if (!config || !canUsePilot(context, config)) return <QuotePaused />;
  const params = await searchParams;
  const index = await loadPilotIndex(config);
  const plans = index.plans.filter(p => !config.hiddenPlanIds.includes(p.id));
  const distinct = (key: "administrator" | "accommodation" | "coparticipation" | "coverage" | "entity") => [...new Set(plans.map(p => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const options: CatalogOptions = { ...index.options, operators: [...new Map(plans.map(p => [p.operatorId, { value: p.operatorId, label: p.operator }])).values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), administrators: distinct("administrator"), accommodations: distinct("accommodation"), coparticipations: distinct("coparticipation"), coverages: distinct("coverage"), entities: distinct("entity") };
  if (params.completo === "1") return <CatalogWorkspace options={options} counts={index.counts} sourceDate={index.sourceDate} />;
  const contagemPorCidade = new Map<string, number>();
  for (const plano of plans) for (const cidade of plano.cities) contagemPorCidade.set(cidade, (contagemPorCidade.get(cidade) ?? 0) + 1);
  const cidadesPopulares = [...contagemPorCidade.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).slice(0, 4).map(([cidade]) => cidade);
  return <CotacaoLiteWorkspace options={options} counts={index.counts} sourceDate={index.sourceDate} cidadesPopulares={cidadesPopulares} />;
}
