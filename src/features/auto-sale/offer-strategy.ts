/**
 * Escolha das opções (§4 do plano). Pura: recebe os resultados do `simulate` e devolve no máximo 3
 * opções dentro do orçamento, uma recomendada com o motivo. Nenhum preço é calculado aqui.
 */
import type { QuoteInput, QuoteResult } from "@/features/global-catalog/pilot/contracts";

import { totalBudgetCents } from "./facts";
import { AUTO_SALE_LIMITS, formatCents, type AutoSaleMode, type DealFacts, type OfferPlan } from "./contracts";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function copartKind(plan: Pick<QuoteResult, "coparticipation">): "sem" | "parcial" | "total" | "desconhecida" {
  const value = fold(plan.coparticipation || "");
  if (!value) return "desconhecida";
  if (/(sem|nao)/.test(value)) return "sem";
  if (/parcial/.test(value)) return "parcial";
  if (/(com|total)/.test(value)) return "total";
  return "desconhecida";
}

function accommodationKind(plan: Pick<QuoteResult, "accommodation">) {
  const value = fold(plan.accommodation || "");
  if (/apart/.test(value)) return "apartamento";
  if (/enferm/.test(value)) return "enfermaria";
  return "outro";
}

/**
 * Pendências do cotador que são só conferência de documento: o motor as põe SEMPRE em PME, adesão e
 * dependentes, e o pedido de documentos do fechamento confere exatamente isso. As demais (plano não
 * revisado, critério sem confirmação na fonte, preço ambíguo, município, limites de vidas e idade,
 * perfil ou tempo de empresa não informados) bloqueiam. Texto igual ao do `simulate` (teste confere).
 */
export const DOCUMENTARY_PENDING_REASONS: ReadonlySet<string> = new Set([
  "Exigências de tempo de empresa, vínculo e formação do grupo precisam de conferência para este perfil.",
  "Confirmar vínculo e documentação de cada dependente nas condições do produto.",
  "Confirmar profissão, entidade e documentação de adesão.",
]);

/** O plano só depende de conferir documentos (ou já está pronto)? */
export function isReadyExceptDocuments(result: Pick<QuoteResult, "state" | "reasons">) {
  if (result.state === "ready") return true;
  return result.state === "pending" && result.reasons.length > 0 && result.reasons.every((reason) => DOCUMENTARY_PENDING_REASONS.has(reason));
}

/**
 * Planos que o modo permite cotar (D4, revisto em 12/11): Autopiloto cota o que está pronto ou só depende
 * de conferir documentos (assim adesão, PME e família entram); Copiloto e Simulação, qualquer não incompatível.
 */
export function allowedForMode(result: QuoteResult, mode: AutoSaleMode) {
  if (result.state === "incompatible") return false;
  return mode === "autopilot" ? isReadyExceptDocuments(result) : true;
}

function preferenceScore(plan: QuoteResult, facts: DealFacts) {
  let score = 0;
  const copart = copartKind(plan);
  // Os ganhadores: sem coparticipação, ou parcial (estudo de 12/11).
  if (facts.coparticipation === "sem" || !facts.coparticipation) score += copart === "sem" ? 3 : copart === "parcial" ? 2 : 0;
  else if (facts.coparticipation === "parcial") score += copart === "parcial" ? 3 : copart === "sem" ? 2 : 0;
  else if (facts.coparticipation === "total") score += copart === "total" ? 3 : 1;
  if (facts.accommodation && facts.accommodation !== "indiferente" && accommodationKind(plan) === facts.accommodation) score += 1;
  if (isReadyExceptDocuments(plan)) score += 1;
  return score;
}

export function toOfferPlan(result: QuoteResult): OfferPlan {
  return {
    id: result.id, name: result.name, operator: result.operator, administrator: result.administrator,
    accommodation: result.accommodation, coparticipation: result.coparticipation, coverage: result.coverage, entity: result.entity,
    totalCents: result.totalCents, perLife: result.perLife, state: result.state, reasons: result.reasons,
  };
}

export type OfferSelection = { plans: OfferPlan[]; recommendedPlanId: string | null; recommendationReason: string | null };

/** Até 3 opções, em ordem de preço, preferindo operadoras diferentes; a recomendada é a de melhor encaixe. */
export function selectOptions(results: readonly QuoteResult[], facts: DealFacts, mode: AutoSaleMode): OfferSelection {
  const pool = results
    .filter((result) => allowedForMode(result, mode))
    .filter((result) => { const budget = totalBudgetCents(facts); return budget === null || result.totalCents <= budget; })
    .slice(0, 24);
  if (!pool.length) return { plans: [], recommendedPlanId: null, recommendationReason: null };
  const ranked = [...pool].sort((a, b) => preferenceScore(b, facts) - preferenceScore(a, facts) || a.totalCents - b.totalCents || a.id.localeCompare(b.id));
  const chosen: QuoteResult[] = [];
  for (const candidate of ranked) {
    if (chosen.length >= AUTO_SALE_LIMITS.maxOptions) break;
    if (chosen.some((plan) => plan.operator === candidate.operator)) continue;
    chosen.push(candidate);
  }
  for (const candidate of ranked) {
    if (chosen.length >= AUTO_SALE_LIMITS.maxOptions) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  const recommended = chosen[0];
  const plans = [...chosen].sort((a, b) => a.totalCents - b.totalCents || a.id.localeCompare(b.id)).map(toOfferPlan);
  return { plans, recommendedPlanId: recommended.id, recommendationReason: recommendationReason(recommended, plans, facts) };
}

export function recommendationReason(plan: Pick<QuoteResult, "name" | "operator" | "coparticipation" | "totalCents">, plans: readonly OfferPlan[], facts: DealFacts) {
  const parts: string[] = [];
  const copart = copartKind(plan);
  if (copart === "sem") parts.push("não tem coparticipação");
  else if (copart === "parcial") parts.push("tem coparticipação só parcial");
  if (facts.budgetCents !== undefined) parts.push("cabe no seu orçamento");
  if (plans.length > 1 && plans[0]?.totalCents === plan.totalCents) parts.push("é o de menor valor entre as opções");
  const why = parts.length ? parts.join(", ").replace(/, ([^,]*)$/, " e $1") : "tem o melhor equilíbrio entre preço e cobertura entre as opções";
  return `Eu indicaria o ${plan.operator} ${plan.name} porque ${why}.`;
}

/** Ordem de relaxamento da "opção mais em conta": um filtro por vez, com o que mudou. */
export const CHEAPER_RELAXATIONS = [
  { filter: "accommodation", label: "troquei apartamento por enfermaria" },
  { filter: "coparticipation", label: "incluí planos com coparticipação" },
  { filter: "operator", label: "abri para outras operadoras" },
  { filter: "entity", label: "abri para outras entidades de adesão" },
] as const;

export function relaxInput(input: QuoteInput, filter: (typeof CHEAPER_RELAXATIONS)[number]["filter"]): QuoteInput {
  return { ...input, [filter]: "", budgetCents: null, page: 1 };
}

/** O mais barato que custa menos que a oferta anterior; null quando não há nada mais em conta. */
export function pickCheaper(results: readonly QuoteResult[], previousCheapestCents: number, mode: AutoSaleMode): QuoteResult[] {
  return results.filter((result) => allowedForMode(result, mode) && result.totalCents < previousCheapestCents).slice(0, AUTO_SALE_LIMITS.maxOptions);
}

export function savingsLine(previousCents: number, nextCents: number) {
  return previousCents > nextCents ? `${formatCents(previousCents - nextCents)} a menos por mês` : null;
}
