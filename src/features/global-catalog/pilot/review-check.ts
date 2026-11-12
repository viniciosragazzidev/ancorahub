/**
 * Conferência automática de um plano do catálogo antes da revisão comercial (pedido do Vinicios, 12/11:
 * "conferir todos e aprovar todos"). Pura. Confere o que dá para conferir nos dados do lote; não substitui
 * a leitura do material da operadora, que continua sendo responsabilidade de quem registra a revisão.
 */
import type { CatalogPlan } from "./contracts";
import { activeAt, selectPrice } from "./engine";

/** Faixas etárias da ANS (idade de referência de cada uma). */
export const ANS_AGE_BANDS = [0, 19, 24, 29, 34, 39, 44, 49, 54, 59] as const;

export type ReviewIssue =
  | "out_of_validity"
  | "no_active_price"
  | "age_band_without_price"
  | "ambiguous_price"
  | "no_city"
  | "criteria_unconfirmed"
  | "business_unconfirmed";

export const REVIEW_ISSUE_LABEL: Record<ReviewIssue, string> = {
  out_of_validity: "Fora da vigência hoje",
  no_active_price: "Sem preço ativo",
  age_band_without_price: "Faixa etária sem preço",
  ambiguous_price: "Dois preços para a mesma faixa",
  no_city: "Sem município de comercialização",
  criteria_unconfirmed: "Idade ou elegibilidade sem confirmação na fonte",
  business_unconfirmed: "Perfil de empresa sem confirmação na fonte",
};

/** Problemas encontrados no plano; lista vazia = passou na conferência automática. */
export function reviewIssues(plan: CatalogPlan, date: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  if (!activeAt(plan.from, plan.to, date)) issues.push("out_of_validity");
  const active = plan.prices.filter((price) => price.active && price.cents > 0 && activeAt(price.from, price.to, date));
  if (!active.length) issues.push("no_active_price");
  else {
    const minAge = Math.min(plan.minAge ?? 0, plan.dependentMin ?? plan.minAge ?? 0);
    const maxAge = plan.maxAge ?? 120;
    const bands = ANS_AGE_BANDS.filter((age) => age >= minAge && age <= maxAge);
    const choices = bands.map((age) => selectPrice(plan.prices, age, date));
    if (choices.some((choice) => !choice.price)) issues.push("age_band_without_price");
    if (choices.some((choice) => choice.ambiguous)) issues.push("ambiguous_price");
  }
  if (!plan.cities.length) issues.push("no_city");
  if (!plan.ageConfirmed || !plan.eligibilityConfirmed) issues.push("criteria_unconfirmed");
  if (plan.modality.startsWith("PME") && !plan.businessConfirmed) issues.push("business_unconfirmed");
  return issues;
}

export type ReviewSummary = { total: number; passed: number; reviewed: number; issues: Partial<Record<ReviewIssue, number>> };

export function summarizeReview(plans: readonly { issues: readonly ReviewIssue[]; reviewed: boolean }[]): ReviewSummary {
  const summary: ReviewSummary = { total: plans.length, passed: 0, reviewed: 0, issues: {} };
  for (const plan of plans) {
    if (plan.reviewed) summary.reviewed += 1;
    if (!plan.issues.length) summary.passed += 1;
    for (const issue of plan.issues) summary.issues[issue] = (summary.issues[issue] ?? 0) + 1;
  }
  return summary;
}
