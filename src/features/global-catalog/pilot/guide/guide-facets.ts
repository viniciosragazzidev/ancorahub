import { modalities, type CatalogPlan } from "../contracts";
import { uniqueCities, type Facet, type GuideFacets, type Modality } from "./guide-flow";

function tally(values: string[]): Facet[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR"));
}

/** Opções da cotação guiada por modalidade, com a contagem de planos visíveis de cada uma. */
export function buildGuideFacets(plans: readonly CatalogPlan[], options: { cities: string[]; businessProfiles: string[] }, sourceDate: string): GuideFacets {
  const byModality = Object.fromEntries(modalities.map((modality) => {
    const own = plans.filter((plan) => plan.modality === modality);
    const operators = new Map<string, { label: string; count: number }>();
    for (const plan of own) {
      const current = operators.get(plan.operatorId);
      operators.set(plan.operatorId, { label: plan.operator, count: (current?.count ?? 0) + 1 });
    }
    return [modality, {
      plans: own.length,
      accommodations: tally(own.map((plan) => plan.accommodation)),
      coparticipations: tally(own.map((plan) => plan.coparticipation)),
      entities: tally(own.map((plan) => plan.entity).filter(Boolean)),
      operators: [...operators].map(([value, { label, count }]) => ({ value, label, count })).sort((a, b) => b.count - a.count),
    }];
  })) as GuideFacets["modalities"];
  return {
    sourceDate,
    totalPlans: plans.length,
    cities: uniqueCities(options.cities),
    businessProfiles: [...options.businessProfiles].sort((a, b) => a.localeCompare(b, "pt-BR")),
    modalities: byModality,
  };
}

export type { Modality };
