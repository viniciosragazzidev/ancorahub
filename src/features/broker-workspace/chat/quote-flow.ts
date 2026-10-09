import type { ChatBlock, ChatChoice, ChatProgress } from "@/components/chat/types";
import {
  ACCOMMODATION_LABEL,
  COPAYMENT_LABEL,
  COVERAGE_LABEL,
  lifeLabel,
  MAX_LIVES,
  money,
  PROFILE_LABEL,
  REGION_LABEL,
} from "@/features/broker-workspace/components/light-quote-simulator/constants";
import {
  MOCK_PLANS,
  REGIONS,
  type Accommodation,
  type Copayment,
  type Coverage,
  type MockPlan,
  type ProfileType,
  type Region,
} from "@/features/broker-workspace/quote-simulator/mock-data";
import { calculatePlanPricing, type PlanPricing } from "@/features/broker-workspace/quote-simulator/pricing";

/**
 * The guided quote (assistant Cotação, route /cotacao): one question at a
 * time, then the cheapest plans as chat cards. Pure: the screen keeps the
 * answers and asks this module what comes next. Prices come from the same
 * demonstration pricing as the full simulator.
 */
export type QuoteAnswers = {
  profile?: ProfileType;
  entity?: string;
  ages?: number[];
  region?: Region;
  accommodation?: Accommodation;
  copayment?: Copayment;
  coverage?: Coverage;
};

export type QuoteResult = { plan: MockPlan; pricing: PlanPricing; monthly: number };

/** Steps counted in "Montando a cotação · x de 6". */
export const QUOTE_STEPS = 6;
export const RESULTS_SHOWN = 3;

/** What the next answer fills: a reply (choices) or text typed in the composer. */
export type QuoteAwaiting = "profile" | "entity" | "ages" | "region" | "accommodation" | "copayment" | "coverage" | "done";

export function quoteAwaiting(answers: QuoteAnswers): QuoteAwaiting {
  if (!answers.profile) return "profile";
  if (answers.profile === "adhesion" && !answers.entity) return "entity";
  if (!answers.ages) return "ages";
  if (!answers.region) return "region";
  if (!answers.accommodation) return "accommodation";
  if (!answers.copayment) return "copayment";
  if (!answers.coverage) return "coverage";
  return "done";
}

export function quoteProgress(answers: QuoteAnswers): ChatProgress {
  const done = [answers.profile, answers.ages, answers.region, answers.accommodation, answers.copayment, answers.coverage].filter((value) => value !== undefined).length;
  return { title: "Montando a cotação", done, total: QUOTE_STEPS };
}

/** "35, 32 e 8" → [35, 32, 8]; checks the count the profile allows. */
export function parseAges(text: string, profile: ProfileType | undefined): { ages: number[] } | { error: string } {
  const ages = (text.match(/\d+/g) ?? []).map(Number);
  if (!ages.length) return { error: "Não achei nenhuma idade. Escreva só os números, separados por vírgula. Ex.: 35, 32, 8" };
  if (ages.some((age) => age > 120)) return { error: "Alguma idade passou de 120 anos. Confere e manda de novo?" };
  if (ages.length > MAX_LIVES) return { error: `Cabem até ${MAX_LIVES} vidas nesta simulação.` };
  if (profile === "pme" && ages.length < 2) return { error: "PME precisa de pelo menos 2 vidas. Manda as idades de todos." };
  if (profile === "individual" && ages.length > 1) return { error: "Pessoa física é uma vida só. Se forem mais pessoas, refaça como Familiar." };
  return { ages };
}

function local(field: string, value: string) {
  return { kind: "local" as const, value: `${field}:${value}` };
}

function choiceList<T extends string>(field: string, labels: Record<T, string>, order: readonly T[], hints: Partial<Record<T, string>> = {}): ChatChoice[] {
  return order.map((value) => ({ id: `${field}-${value}`, label: labels[value], hint: hints[value], action: local(field, value) }));
}

/** The question for what is missing (or the results when everything was answered). */
export function nextQuoteBlocks(answers: QuoteAnswers): ChatBlock[] {
  switch (quoteAwaiting(answers)) {
    case "profile":
      return [{
        type: "question",
        id: "q-profile",
        prompt: "Para quem é a cotação?",
        choices: choiceList("profile", { individual: "Pessoa física", family: "Família", pme: "Empresa (PME)", adhesion: "Adesão (por profissão)" }, ["individual", "family", "pme", "adhesion"], { pme: "De 2 a 29 vidas" }),
      }];
    case "entity":
      return [{ type: "assistant", id: "a-entity", text: "Qual a profissão e a entidade de classe? Escreva aqui embaixo." }];
    case "ages":
      return [{
        type: "assistant",
        id: "a-ages",
        text: answers.profile === "individual" ? "Qual a idade dele? Escreva aqui embaixo." : "Quais as idades de quem vai entrar no plano? Escreva separando por vírgula. Ex.: 35, 32, 8",
      }];
    case "region":
      return [{ type: "question", id: "q-region", prompt: "Em qual região ele mora?", choices: REGIONS.map((region) => ({ id: `region-${region.value}`, label: region.label, action: local("region", region.value) })) }];
    case "accommodation":
      return [{ type: "question", id: "q-accommodation", prompt: "Enfermaria ou apartamento?", choices: choiceList("accommodation", ACCOMMODATION_LABEL, ["ward", "private"], { ward: "Quarto coletivo, mais em conta", private: "Quarto individual" }) }];
    case "copayment":
      return [{ type: "question", id: "q-copayment", prompt: "E a coparticipação?", choices: choiceList("copayment", { none: "Sem coparticipação", partial: "Parcial", full: "Total" } satisfies Record<Copayment, string>, ["none", "partial", "full"], { none: "Mensalidade maior, sem cobrança por uso", full: "Mensalidade menor, paga por uso" }) }];
    case "coverage":
      return [{ type: "question", id: "q-coverage", prompt: "Qual abrangência?", choices: choiceList("coverage", COVERAGE_LABEL, ["regional", "state", "national"]) }];
    case "done":
      return resultBlocks(answers, 0);
  }
}

/** Plans that fit the answers, cheapest first (PME with 2+ lives gets the 5% of the full simulator). */
export function quoteResults(answers: QuoteAnswers): QuoteResult[] {
  const { profile, ages, region, accommodation, copayment, coverage } = answers;
  if (!profile || !ages || !region || !accommodation || !copayment || !coverage) return [];
  const beneficiaries = ages.map((age, index) => ({ id: `life-${index}`, age }));
  const discount = profile === "pme" && ages.length >= 2 ? 0.05 : 0;
  return MOCK_PLANS
    .filter((plan) => plan.regions.includes(region) && plan.accommodations.includes(accommodation) && plan.copayments.includes(copayment) && plan.coverages.includes(coverage))
    .map((plan) => {
      const pricing = calculatePlanPricing(plan, { profileType: profile, region, accommodation, copayment, coverage, includeDental: false }, beneficiaries);
      return { plan, pricing, monthly: Math.round(pricing.monthlyTotal * (1 - discount) * 100) / 100 };
    })
    .sort((left, right) => left.monthly - right.monthly);
}

function profileLine(answers: QuoteAnswers) {
  const lives = answers.ages?.length ?? 0;
  return [
    answers.profile ? PROFILE_LABEL[answers.profile] : null,
    lifeLabel(lives),
    answers.region ? REGION_LABEL[answers.region] : null,
    answers.accommodation ? ACCOMMODATION_LABEL[answers.accommodation] : null,
    answers.copayment ? COPAYMENT_LABEL[answers.copayment].toLocaleLowerCase("pt-BR") : null,
    answers.coverage ? COVERAGE_LABEL[answers.coverage].toLocaleLowerCase("pt-BR") : null,
  ].filter(Boolean).join(", ");
}

/** Results as chat: a short line, the 3 cheapest as a list and which one to present. `round` keeps ids unique when shown again. */
export function resultBlocks(answers: QuoteAnswers, round: number): ChatBlock[] {
  const results = quoteResults(answers);
  const suffix = round ? `-${round}` : "";
  const restart: ChatChoice = { id: "restart", label: "Refazer a cotação", action: local("restart", "1") };
  const full: ChatChoice = { id: "full", label: "Abrir o simulador completo", hint: "Filtros, rede e comparação", action: { kind: "href", href: "/cotacao?completo=1" } };
  if (!results.length) {
    return [
      { type: "assistant", id: `a-empty${suffix}`, text: `Não achei plano para ${profileLine(answers)}. Tente outra abrangência ou coparticipação.` },
      { type: "question", id: `q-empty${suffix}`, prompt: "Como quer seguir?", choices: [restart, full] },
    ];
  }
  const top = results.slice(0, RESULTS_SHOWN);
  return [
    { type: "assistant", id: `a-results${suffix}`, text: `Achei ${results.length} ${results.length === 1 ? "plano" : "planos"} para ${profileLine(answers)}. ${results.length > RESULTS_SHOWN ? "Os 3 mais em conta:" : ""}`.trim() },
    {
      type: "list",
      id: `l-results${suffix}`,
      title: "Planos mais em conta",
      subtitle: "Valores demonstrativos",
      items: top.map(({ plan, pricing, monthly }) => ({ id: plan.id, primary: `${plan.carrier.replace(" (exemplo)", "")} ${plan.name}`, secondary: `${money(pricing.monthlyPerLife)} por vida`, trailing: money(monthly) })),
    },
    {
      type: "question",
      id: `q-plan${suffix}`,
      prompt: "Qual você quer apresentar?",
      choices: [
        ...top.map(({ plan, monthly }) => ({ id: `plan-${plan.id}`, label: `${plan.carrier.replace(" (exemplo)", "")} ${plan.name}`, hint: `${money(monthly)} por mês`, action: local("plan", plan.id) })),
        full,
      ],
    },
  ];
}

/** Text sent to the client (WhatsApp or copied). */
export function quoteSummaryText(answers: QuoteAnswers, result: QuoteResult) {
  return `Olá! Segue uma simulação de plano de saúde: ${result.plan.carrier.replace(" (exemplo)", "")} ${result.plan.name}, ${lifeLabel(answers.ages?.length ?? 0)}, ${ACCOMMODATION_LABEL[answers.accommodation ?? "ward"].toLocaleLowerCase("pt-BR")}, total estimado de ${money(result.monthly)} por mês. Valores sujeitos à análise da operadora.`;
}

export function quoteWhatsAppHref(answers: QuoteAnswers, result: QuoteResult) {
  return `https://wa.me/?text=${encodeURIComponent(quoteSummaryText(answers, result))}`;
}

/** The chosen plan as a facts card and what to do with it. */
export function chosenPlanBlocks(answers: QuoteAnswers, planId: string, round: number): ChatBlock[] {
  const result = quoteResults(answers).find(({ plan }) => plan.id === planId);
  if (!result) return [{ type: "assistant", id: `a-missing-${round}`, text: "Esse plano não está mais na lista. Escolha outro." }];
  const { plan, pricing, monthly } = result;
  return [
    {
      type: "facts",
      id: `f-plan-${round}`,
      title: `${plan.carrier.replace(" (exemplo)", "")} ${plan.name}`,
      subtitle: "Simulação demonstrativa",
      rows: [
        { label: "Total por mês", value: money(monthly) },
        { label: "Por vida", value: money(pricing.monthlyPerLife) },
        { label: "Vidas", value: lifeLabel(answers.ages?.length ?? 0) },
        { label: "Categoria", value: plan.tier },
        { label: "Carência", value: plan.waitingPeriodSummary },
        { label: "Rede", value: plan.hospitals.slice(0, 3).join(", ") || "Rede regional" },
      ],
    },
    { type: "assistant", id: `a-plan-${round}`, text: "Os valores são estimativas e dependem da análise da operadora. Quer mandar pro cliente?" },
    {
      type: "question",
      id: `q-send-${round}`,
      prompt: "O que você quer fazer?",
      choices: [
        { id: "whatsapp", label: "Enviar no WhatsApp", hint: "Abre com o resumo pronto, é só escolher o cliente", reply: "Envia no WhatsApp", action: { kind: "href", href: quoteWhatsAppHref(answers, result) } },
        { id: "copy", label: "Copiar o resumo", action: local("send", "copy") },
        { id: "other", label: "Ver outro plano", action: local("back", "plans") },
        { id: "restart", label: "Refazer a cotação", action: local("restart", "1") },
      ],
    },
  ];
}

/** Applies a local reply ("field:value") to the answers. Returns null for values that are not answers. */
export function applyQuoteChoice(answers: QuoteAnswers, raw: string): QuoteAnswers | null {
  const [field, value] = raw.split(":");
  switch (field) {
    case "profile": return ["individual", "family", "pme", "adhesion"].includes(value) ? { ...answers, profile: value as ProfileType, entity: undefined, ages: undefined } : null;
    case "region": return REGIONS.some((region) => region.value === value) ? { ...answers, region: value as Region } : null;
    case "accommodation": return value === "ward" || value === "private" ? { ...answers, accommodation: value } : null;
    case "copayment": return value === "none" || value === "partial" || value === "full" ? { ...answers, copayment: value } : null;
    case "coverage": return value === "regional" || value === "state" || value === "national" ? { ...answers, coverage: value } : null;
    default: return null;
  }
}
