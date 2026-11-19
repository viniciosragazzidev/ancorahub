/**
 * O rascunho da Sasá virando respostas das conversas guiadas (fase 4). Reaproveita o mesmo caminho da leitura do
 * contrato (`mergeContractReading`) e as funções da cotação; só que o que foi dito à Sasá conta como informado
 * pelo corretor, não "do contrato" (o resumo não marca nada como lido).
 */
import type { GuideAnswers, GuideFacets } from "@/features/global-catalog/pilot/guide/guide-flow";
import { mergeContractReading, type SaleAnswers, type SaleCatalog, type SaleContractReading } from "@/features/post-sale/conversation-sale-core";

import { mentionedIn, type QuoteSpokenDraft, type SaleSpokenDraft } from "./drafts";

export function mergeSpokenSale(draft: SaleSpokenDraft, catalog: SaleCatalog, today: Date): { answers: SaleAnswers; found: string[] } {
  const plans = catalog.carriers.flatMap((carrier) => carrier.plans.map((plan) => ({ ...plan, carrier })));
  const plan = mentionedIn(plans, draft.text);
  const carrier = plan?.carrier ?? mentionedIn(catalog.carriers, draft.text);
  const reading: SaleContractReading = {
    planType: draft.planType ?? null,
    ages: draft.ages ?? null,
    carrierName: carrier?.name ?? null,
    planName: plan?.name ?? null,
    monthlyValue: draft.monthlyValue ?? null,
    coverageStartDate: draft.coverageStartDate ?? null,
  };
  const merged = mergeContractReading({}, reading, catalog, today);
  return { answers: { ...merged.answers, fromContract: false, sourced: [] }, found: merged.found };
}

export function mergeSpokenQuote(draft: QuoteSpokenDraft, facets: Pick<GuideFacets, "cities">): { answers: GuideAnswers; found: string[] } {
  const answers: GuideAnswers = {};
  const found: string[] = [];
  if (draft.kind) answers.kind = draft.kind;
  if (draft.audience) {
    answers.audience = draft.audience;
    found.push(draft.audience === "PME_EMPRESARIAL" ? "PME" : draft.audience === "ADESAO" ? "por adesão" : "pessoa física");
  }
  const city = mentionedIn((facets.cities ?? []).map((name) => ({ name })), draft.text);
  if (city) { answers.city = city.name; found.push(city.name); }
  if (draft.ages?.length) {
    answers.ages = draft.ages;
    found.push(draft.ages.length === 1 ? `${draft.ages[0]} anos` : `${draft.ages.length} vidas (${draft.ages.join(", ")} anos)`);
  }
  return { answers, found };
}
