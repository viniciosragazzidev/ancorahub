import type { AvailableCatalogPlan } from "@/features/global-catalog/types";

import type { SaleCatalog, SaleCatalogCarrier, SalePlanType } from "./conversation-sale-core";

export type LegacyRow = { carrierId: string; carrierName: string; planId: string | null; planName: string | null; planType: string | null };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Junta os dois catálogos da corretora numa lista de operadoras com os seus planos. A mesma operadora (pelo nome)
 * nos dois vira uma só: os planos do catálogo antigo primeiro (eles ligam a venda às comissões), depois os do
 * catálogo novo que ainda não estão lá. Puro, para testar sem banco.
 */
export function mergeSaleCatalog(legacy: LegacyRow[], available: Pick<AvailableCatalogPlan, "planId" | "carrierId" | "carrierName" | "planName" | "planType">[]): SaleCatalog {
  const byName = new Map<string, SaleCatalogCarrier>();
  const carrierFor = (id: string, name: string, legacyId: string | null) => {
    const key = normalize(name);
    const current = byName.get(key);
    if (current) {
      if (legacyId && !current.legacyId) current.legacyId = legacyId;
      return current;
    }
    const created: SaleCatalogCarrier = { id, name: name.trim(), legacyId, plans: [] };
    byName.set(key, created);
    return created;
  };
  for (const row of legacy) {
    const carrier = carrierFor(row.carrierId, row.carrierName, row.carrierId);
    if (row.planId && row.planName) carrier.plans.push({ id: row.planId, name: row.planName, type: (row.planType ?? "individual") as SalePlanType, source: "legacy" });
  }
  for (const plan of available) {
    const carrier = carrierFor(`catalog:${plan.carrierId}`, plan.carrierName, null);
    const name = normalize(plan.planName);
    if (carrier.plans.some((item) => item.id === plan.planId || normalize(item.name) === name)) continue;
    carrier.plans.push({ id: plan.planId, name: plan.planName, type: plan.planType, source: "catalog" });
  }
  const carriers = [...byName.values()]
    .map((carrier) => ({ ...carrier, plans: [...carrier.plans].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { carriers };
}
