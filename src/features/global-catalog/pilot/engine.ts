import type { CatalogPlan, Price, QuoteInput, QuoteResponse, QuoteResult } from "./contracts";

export const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export function activeAt(from: string | null, to: string | null, date: string) { return (!from || from.slice(0, 10) <= date) && (!to || to.slice(0, 10) >= date); }
export function selectPrice(prices: readonly Price[], age: number, date: string) {
  const candidates = prices.filter(p => p.active && p.cents > 0 && Number.isSafeInteger(p.cents) && age >= p.min && (p.max === null || age <= p.max) && activeAt(p.from, p.to, date))
    .sort((a, b) => b.priority - a.priority || (b.from ?? "1900-01-01").localeCompare(a.from ?? "1900-01-01") || a.id.localeCompare(b.id));
  const first = candidates[0];
  if (!first) return { price: null, ambiguous: false };
  const tied = candidates.filter(p => p.priority === first.priority && (p.from ?? "1900-01-01") === (first.from ?? "1900-01-01"));
  return { price: first, ambiguous: tied.some(p => p.cents !== first.cents) };
}

export function priceLives(plan: CatalogPlan, lives: QuoteInput["lives"], date: string) {
  const perLife: QuoteResult["perLife"] = []; let ambiguous = false;
  for (const life of lives) {
    const choice = selectPrice(plan.prices, life.age, date);
    if (!choice.price) return null;
    ambiguous ||= choice.ambiguous;
    perLife.push({ age: life.age, holder: life.holder, cents: choice.price.cents, priceId: choice.price.id, from: choice.price.from, to: choice.price.to });
  }
  const totalCents = perLife.reduce((sum, p) => sum + p.cents, 0);
  if (!Number.isSafeInteger(totalCents)) return null;
  return { totalCents, perLife, ambiguous };
}

export function simulate(plans: readonly CatalogPlan[], input: QuoteInput, date: string, reviewed: ReadonlySet<string>, hidden: ReadonlySet<string>, release: string): QuoteResponse {
  const all: QuoteResult[] = [];
  for (const plan of plans) {
    if (hidden.has(plan.id) || plan.modality !== input.modality || !activeAt(plan.from, plan.to, date)) continue;
    if (input.operator && plan.operatorId !== input.operator) continue;
    if (input.administrator && plan.administrator !== input.administrator) continue;
    if (input.accommodation && plan.accommodation !== input.accommodation) continue;
    if (input.coparticipation && plan.coparticipation !== input.coparticipation) continue;
    if (input.coverage && plan.coverage !== input.coverage) continue;
    if (input.dental && (input.dental === "unknown" ? plan.dental !== null : plan.dental !== (input.dental === "yes"))) continue;
    if (input.entity && !fold(plan.entity).includes(fold(input.entity))) continue;
    if (input.query && !fold(`${plan.name} ${plan.code} ${plan.operator} ${plan.administrator} ${plan.entity}`).includes(fold(input.query))) continue;
    const priced = priceLives(plan, input.lives, date);
    if (!priced || (input.budgetCents !== null && priced.totalCents > input.budgetCents)) continue;
    const incompatible: string[] = [], pending: string[] = [];
    if (input.city && plan.cities.length && !plan.cities.some(city => fold(city) === fold(input.city))) incompatible.push("Município fora da comercialização informada na fonte.");
    if (!input.city || !plan.cities.length) pending.push("Confirmar município de comercialização.");
    if (plan.minLives !== null && input.lives.length < plan.minLives) (plan.eligibilityConfirmed ? incompatible : pending).push(`A fonte informa mínimo de ${plan.minLives} vidas.`);
    if (plan.maxLives !== null && input.lives.length > plan.maxLives) (plan.eligibilityConfirmed ? incompatible : pending).push(`A fonte informa máximo de ${plan.maxLives} vidas.`);
    for (const life of input.lives) {
      const min = life.holder ? plan.holderMin ?? plan.minAge : plan.dependentMin ?? plan.minAge;
      const max = life.holder ? plan.holderMax ?? plan.maxAge : plan.dependentMax ?? plan.maxAge;
      if ((min !== null && life.age < min) || (max !== null && life.age > max)) (plan.ageConfirmed ? incompatible : pending).push(`${life.holder ? "Titular" : "Dependente"}: idade fora do limite informado na fonte.`);
    }
    if ((plan.minHolders ?? 1) > 1) pending.push("Formação do grupo exige mais de um titular; revisar os núcleos antes de formalizar.");
    if (input.businessProfile && plan.businessProfiles.length && !plan.businessProfiles.includes(input.businessProfile) && !plan.businessProfiles.includes("TODOS_CNPJS")) (plan.businessConfirmed ? incompatible : pending).push("Perfil de empresa não consta entre os aceitos na fonte.");
    if (input.modality.startsWith("PME") && (!input.businessProfile || input.businessMonths === null)) pending.push("Confirmar perfil e tempo de empresa, vínculo e formação do grupo.");
    if (input.modality.startsWith("PME")) pending.push("Exigências de tempo de empresa, vínculo e formação do grupo precisam de conferência para este perfil.");
    if (input.lives.some(life => !life.holder)) pending.push("Confirmar vínculo e documentação de cada dependente nas condições do produto.");
    if (input.modality.startsWith("ADESAO")) pending.push("Confirmar profissão, entidade e documentação de adesão.");
    if (!plan.ageConfirmed || !plan.eligibilityConfirmed) pending.push("Existem critérios comerciais sem confirmação estruturada.");
    if (priced.ambiguous) pending.push("Há preços com a mesma prioridade e vigência; a tabela exige revisão.");
    if (!reviewed.has(plan.id)) pending.push("Condições do produto aguardam revisão comercial no catálogo.");
    const state = incompatible.length ? "incompatible" : pending.length ? "pending" : "ready";
    const { prices: _prices, cities: _cities, businessProfiles: _profiles, ...summary } = plan;
    all.push({ ...summary, totalCents: priced.totalCents, perLife: priced.perLife, state, reasons: [...new Set([...incompatible, ...pending])] });
  }
  const incompatible = all.filter(r => r.state === "incompatible").length;
  const pending = all.filter(r => r.state === "pending").length;
  const visible = all.filter(r => input.includeIncompatible || r.state !== "incompatible").sort((a, b) => a.totalCents - b.totalCents || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(visible.length / 24)); const page = Math.min(input.page, pages);
  return { results: visible.slice((page - 1) * 24, page * 24), total: visible.length, page, pages, compatible: all.length - incompatible, pending, incompatible, release, date };
}
