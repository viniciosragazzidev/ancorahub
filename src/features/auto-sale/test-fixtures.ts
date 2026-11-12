/** Dados de teste da Venda Automatizada (sem rede, sem banco). */
import type { QuoteResult } from "@/features/global-catalog/pilot/contracts";

import type { OfferSnapshot } from "./contracts";

export function result(id: string, totalCents: number, overrides: Partial<QuoteResult> = {}): QuoteResult {
  return {
    id, name: `Plano ${id}`, code: id, operator: `Op ${id}`, operatorId: id, administrator: "", modality: "PESSOA_FISICA",
    accommodation: "Enfermaria", coparticipation: "Sem coparticipação", coverage: "Ambulatorial + Hospitalar", entity: "",
    dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null, dependentMax: null,
    minLives: null, maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: true,
    from: null, to: null, networkCount: 0, detailCount: 0,
    totalCents, perLife: [{ age: 30, holder: true, priceId: `p-${id}`, cents: totalCents, from: null, to: null }],
    state: "ready", reasons: [], ...overrides,
  };
}

export function offerFrom(plans: QuoteResult[], extra: Partial<OfferSnapshot> = {}): OfferSnapshot {
  return {
    id: "offer-1", version: 1, plans, recommendedPlanId: plans[0]?.id ?? null, recommendationReason: null, relaxed: null,
    previousOfferId: null, previousTotalCents: null, release: "cotadorfm-2026-11-11-abcdefabcdef", catalogDate: "2026-11-12",
    input: { modality: "PESSOA_FISICA", city: "Niterói", lives: [{ age: 30, holder: true, relationship: "Titular" }], operator: "", administrator: "", profession: "", entity: "", businessProfile: "", businessMonths: null, accommodation: "", coparticipation: "", coverage: "", dental: "", query: "", budgetCents: null, includeIncompatible: false, page: 1 },
    ...extra,
  };
}
