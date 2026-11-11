import type { ChatBlock, ChatChoice, ChatProgress } from "@/components/chat/types";

import type { QuoteInput } from "../contracts";
import { fold } from "../engine";

/**
 * Cotação guiada com o catálogo real (11/11): a mesma conversa da Cotação do Lite (uma pergunta
 * por vez, progresso "x de y", resposta por opção ou digitada) sobre o catálogo do piloto.
 * Puro: a tela guarda as respostas e pergunta aqui o que vem depois.
 */

export type Audience = "PESSOA_FISICA" | "ADESAO" | "PME_EMPRESARIAL";
export type Modality = QuoteInput["modality"];
export type Facet = { value: string; count: number };

/** O que a tela recebe do servidor: opções do catálogo por modalidade, com a contagem de planos. */
export type GuideFacets = {
  sourceDate: string;
  totalPlans: number;
  cities: string[];
  businessProfiles: string[];
  modalities: Record<Modality, {
    plans: number;
    accommodations: Facet[];
    coparticipations: Facet[];
    entities: Facet[];
    operators: Array<Facet & { label: string }>;
  }>;
};

export type GuideAnswers = {
  kind?: "saude" | "odonto";
  audience?: Audience;
  city?: string;
  ages?: number[];
  /** null: o corretor pulou (todas as entidades). */
  entity?: string | null;
  businessProfile?: string | null;
  businessMonths?: number | null;
  accommodation?: string | null;
  coparticipation?: string | null;
  /** Refinos depois do resultado. */
  operator?: string | null;
  budgetCents?: number | null;
};

export type GuideStep = "kind" | "audience" | "city" | "ages" | "entity" | "businessProfile" | "businessMonths" | "accommodation" | "coparticipation";
export type GuideAwaiting = GuideStep | "budget" | "done";

export const AUDIENCE_LABEL: Record<Audience, string> = { PESSOA_FISICA: "Pessoa física", ADESAO: "Adesão (por profissão)", PME_EMPRESARIAL: "Empresa (PME)" };
export const MODALITY_LABEL: Record<Modality, string> = {
  PESSOA_FISICA: "Saúde pessoa física", ADESAO: "Saúde por adesão", PME_EMPRESARIAL: "Saúde empresarial",
  PESSOA_FISICA_ODONTO: "Odonto pessoa física", ADESAO_ODONTO: "Odonto por adesão", PME_EMPRESARIAL_ODONTO: "Odonto empresarial",
};
const BUSINESS_MAIN = ["MEI", "ME", "EPP", "LTDA", "S_A"] as const;
export const BUSINESS_LABEL: Record<string, string> = {
  MEI: "MEI", ME: "ME (microempresa)", EPP: "EPP", LTDA: "LTDA", S_A: "S.A.", EI: "Empresário individual", SS: "Sociedade simples",
  CARTORIO: "Cartório", PRODUTOR_RURAL: "Produtor rural", CAEPF: "CAEPF", DEMAIS_CNPJS: "Outro CNPJ",
};
const MONTHS: Array<{ id: string; label: string; months: number | null; hint?: string }> = [
  { id: "0", label: "Menos de 6 meses", months: 0 },
  { id: "6", label: "De 6 meses a 1 ano", months: 6 },
  { id: "12", label: "De 1 a 2 anos", months: 12 },
  { id: "24", label: "Mais de 2 anos", months: 24 },
  { id: "na", label: "Não sei agora", months: null, hint: "Fica como pendência para conferir" },
];
const QUICK_CITIES = ["Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu"];
export const PLANS_PER_ROUND = 3;
export const MAX_LIVES = 100;

export function modalityOf(answers: GuideAnswers): Modality | null {
  if (!answers.kind || !answers.audience) return null;
  return (answers.kind === "odonto" ? `${answers.audience}_ODONTO` : answers.audience) as Modality;
}

/** Facetas com mais de uma opção de verdade: com uma só (ou nenhuma) a pergunta não ajuda e é pulada. */
function useful(facets: Facet[]) {
  return facets.filter((facet) => facet.value).length > 1;
}

/** Perguntas desta cotação, na ordem. Antes de saber o público, conta a de pessoa física. */
export function guideSteps(answers: GuideAnswers, facets: GuideFacets): GuideStep[] {
  const steps: GuideStep[] = ["kind", "audience", "city", "ages"];
  const audience = answers.audience ?? "PESSOA_FISICA";
  if (audience === "ADESAO") steps.push("entity");
  if (audience === "PME_EMPRESARIAL") steps.push("businessProfile", "businessMonths");
  const modality = modalityOf({ ...answers, kind: answers.kind ?? "saude", audience });
  const facet = modality ? facets.modalities[modality] : null;
  if (facet && useful(facet.accommodations)) steps.push("accommodation");
  if (facet && useful(facet.coparticipations)) steps.push("coparticipation");
  return steps;
}

export function guideAwaiting(answers: GuideAnswers, facets: GuideFacets): GuideAwaiting {
  for (const step of guideSteps(answers, facets)) if (answers[step] === undefined) return step;
  return "done";
}

export function guideProgress(answers: GuideAnswers, facets: GuideFacets): ChatProgress {
  const steps = guideSteps(answers, facets);
  return { title: "Montando a cotação", done: steps.filter((step) => answers[step] !== undefined).length, total: steps.length };
}

const local = (field: string, value: string) => ({ kind: "local" as const, value: `${field}:${value}` });
const count = (value: number) => value.toLocaleString("pt-BR");
const plansHint = (value: number) => `${count(value)} ${value === 1 ? "plano" : "planos"}`;

/** "field:value" → [field, value]; o valor pode ter ":" (nome de entidade). */
export function splitChoice(raw: string): [string, string] {
  const at = raw.indexOf(":");
  return at < 0 ? [raw, ""] : [raw.slice(0, at), raw.slice(at + 1)];
}

/** Uma vez por cidade, preferindo a grafia com acentos e maiúsculas e minúsculas ("Niterói", não "NITEROI"). */
export function uniqueCities(cities: readonly string[]) {
  const score = (city: string) => (city !== city.toUpperCase() ? 2 : 0) + (/\p{M}/u.test(city.normalize("NFD")) ? 1 : 0) + (/ (dos|das|de|do|da) /.test(city) ? 1 : 0);
  const best = new Map<string, string>();
  for (const city of cities) {
    const key = fold(city);
    const current = best.get(key);
    if (!current || score(city) > score(current)) best.set(key, city);
  }
  return [...best.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Município digitado: exato (sem acento e caixa) vale na hora; senão as cidades que contêm o texto. */
export function matchCity(text: string, cities: readonly string[]): { city: string } | { options: string[] } | { error: string } {
  const typed = fold(text);
  if (typed.length < 2) return { error: "Escreva o nome do município. Ex.: Niterói" };
  const exact = cities.find((city) => fold(city) === typed);
  if (exact) return { city: exact };
  const options = cities.filter((city) => fold(city).includes(typed)).slice(0, 6);
  if (options.length === 1) return { city: options[0] };
  if (options.length) return { options };
  return { error: `Não achei "${text.trim()}" no catálogo. Confere o nome e manda de novo?` };
}

/** Entidade digitada: pela sigla ou pelo nome, entre as que têm plano nesta modalidade. */
export function matchEntity(text: string, entities: readonly Facet[]): { entity: string } | { options: Facet[] } | { error: string } {
  const typed = fold(text);
  if (typed.length < 2) return { error: "Escreva a sigla ou o nome da entidade. Ex.: OAB" };
  const options = entities.filter((entity) => entity.value && fold(entity.value).includes(typed)).sort((a, b) => b.count - a.count);
  if (options.length === 1) return { entity: options[0].value };
  if (options.length) return { options: options.slice(0, 6) };
  return { error: `Nenhuma entidade com "${text.trim()}" neste catálogo. Tente a sigla (ex.: OAB, CREA) ou pule.` };
}

/** "35, 32 e 8" → [35, 32, 8]. A primeira idade é a do titular. */
export function parseAges(text: string): { ages: number[] } | { error: string } {
  const ages = (text.match(/\d+/g) ?? []).map(Number);
  if (!ages.length) return { error: "Não achei nenhuma idade. Escreva só os números, separados por vírgula. Ex.: 35, 32, 8" };
  if (ages.some((age) => age > 120)) return { error: "Alguma idade passou de 120 anos. Confere e manda de novo?" };
  if (ages.length > MAX_LIVES) return { error: `Cabem até ${MAX_LIVES} vidas por cotação.` };
  return { ages };
}

/** "1.500", "1500,50", "R$ 2 mil" → centavos. */
export function parseBudget(text: string): { cents: number } | { error: string } {
  const clean = text.replace(/r\$|\s/gi, "").toLocaleLowerCase("pt-BR");
  const thousand = /mil$/.test(clean);
  const raw = clean.replace(/mil$/, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) return { error: "Escreva o valor máximo por mês. Ex.: 1.500" };
  const [whole, fraction = ""] = raw.replaceAll(".", "").split(",");
  const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) * (thousand ? 1000 : 1);
  if (!Number.isSafeInteger(cents) || cents <= 0) return { error: "Escreva um valor maior que zero. Ex.: 1.500" };
  return { cents };
}

export function lifeLabel(lives: number) {
  return `${lives} ${lives === 1 ? "vida" : "vidas"}`;
}

/** Resumo de uma linha: "Saúde por adesão, 3 vidas, Niterói, apartamento". */
export function profileLine(answers: GuideAnswers) {
  const modality = modalityOf(answers);
  return [
    modality ? MODALITY_LABEL[modality] : null,
    answers.ages ? lifeLabel(answers.ages.length) : null,
    answers.city ?? null,
    answers.accommodation ? answers.accommodation.toLocaleLowerCase("pt-BR") : null,
    answers.coparticipation ? answers.coparticipation.toLocaleLowerCase("pt-BR") : null,
  ].filter(Boolean).join(", ");
}

export function toQuoteInput(answers: GuideAnswers, page = 1): QuoteInput | null {
  const modality = modalityOf(answers);
  if (!modality || !answers.ages?.length || !answers.city) return null;
  return {
    modality,
    city: answers.city,
    lives: answers.ages.map((age, index) => ({ age, holder: index === 0, relationship: index === 0 ? "Titular" : "Dependente" })),
    operator: answers.operator ?? "",
    administrator: "",
    profession: "",
    entity: answers.entity ?? "",
    businessProfile: answers.businessProfile ?? "",
    businessMonths: answers.businessMonths ?? null,
    accommodation: answers.accommodation ?? "",
    coparticipation: answers.coparticipation ?? "",
    coverage: "",
    dental: "",
    query: "",
    budgetCents: answers.budgetCents ?? null,
    includeIncompatible: false,
    page,
  };
}

function remainingNudge(answers: GuideAnswers, facets: GuideFacets, round: number): ChatBlock[] {
  const { done, total } = guideProgress(answers, facets);
  const left = total - done;
  if (left === 2 && done >= 3) return [{ type: "assistant", id: `a-nudge-${round}`, text: "Boa, faltam só 2." }];
  if (left === 1 && done >= 4) return [{ type: "assistant", id: `a-nudge-${round}`, text: "Última pergunta." }];
  return [];
}

/** A pergunta do que falta (ou nada quando tudo foi respondido: aí a tela busca os planos). */
export function nextGuideBlocks(answers: GuideAnswers, facets: GuideFacets, round: number): ChatBlock[] {
  const id = (name: string) => `${name}-${round}`;
  const modality = modalityOf(answers);
  const facet = modality ? facets.modalities[modality] : null;
  const awaiting = guideAwaiting(answers, facets);
  const nudge = awaiting === "done" || awaiting === "kind" || awaiting === "audience" ? [] : remainingNudge(answers, facets, round);
  switch (awaiting) {
    case "kind": {
      const health = (["PESSOA_FISICA", "ADESAO", "PME_EMPRESARIAL"] as const).reduce((sum, key) => sum + facets.modalities[key].plans, 0);
      const dental = facets.totalPlans - health;
      return [{
        type: "question", id: id("q-kind"), prompt: "Que tipo de plano vamos cotar?",
        choices: [
          { id: "kind-saude", label: "Saúde", hint: plansHint(health), action: local("kind", "saude") },
          { id: "kind-odonto", label: "Odonto", hint: plansHint(dental), action: local("kind", "odonto") },
        ],
      }];
    }
    case "audience": {
      const suffix = answers.kind === "odonto" ? "_ODONTO" : "";
      const choices: ChatChoice[] = (["PESSOA_FISICA", "ADESAO", "PME_EMPRESARIAL"] as const)
        .map((audience) => ({ audience, plans: facets.modalities[`${audience}${suffix}` as Modality].plans }))
        .filter(({ plans }) => plans > 0)
        .map(({ audience, plans }) => ({ id: `audience-${audience}`, label: AUDIENCE_LABEL[audience], hint: plansHint(plans), action: local("audience", audience) }));
      return [{ type: "question", id: id("q-audience"), prompt: "Para quem é o plano?", choices }];
    }
    case "city": {
      const known = new Set(facets.cities.map(fold));
      const quick = QUICK_CITIES.filter((city) => known.has(fold(city)));
      return [
        ...nudge,
        quick.length
          ? { type: "question", id: id("q-city"), prompt: "Em qual município o cliente mora? Toque ou escreva aqui embaixo.", choices: quick.map((city) => ({ id: `city-${fold(city)}`, label: city, action: local("city", facets.cities.find((known) => fold(known) === fold(city)) ?? city) })) }
          : { type: "assistant", id: id("a-city"), text: "Em qual município o cliente mora? Escreva aqui embaixo." },
      ];
    }
    case "ages":
      return [...nudge, {
        type: "assistant", id: id("a-ages"),
        text: answers.audience === "PME_EMPRESARIAL"
          ? "Quais as idades de quem entra no plano? A primeira é a do titular. Ex.: 42, 38, 29"
          : "Quais as idades? A primeira é a do titular, depois os dependentes. Ex.: 35, 32, 8",
      }];
    case "entity": {
      const top = (facet?.entities ?? []).filter((entity) => entity.value).sort((a, b) => b.count - a.count).slice(0, 4);
      return [...nudge, {
        type: "question", id: id("q-entity"), prompt: "Qual a entidade de classe? Toque numa das mais usadas ou escreva a sigla.",
        choices: [
          ...top.map((entity, index) => ({ id: `entity-${index}`, label: shortEntity(entity.value), hint: plansHint(entity.count), action: local("entity", entity.value) })),
          { id: "entity-skip", label: "Ainda não sei", hint: "Mostro de todas as entidades", reply: "Ainda não sei a entidade", action: local("entity", "") },
        ],
      }];
    }
    case "businessProfile": {
      const available = new Set(facets.businessProfiles);
      const main = BUSINESS_MAIN.filter((value) => available.has(value));
      const others = facets.businessProfiles.filter((value) => !main.includes(value as (typeof BUSINESS_MAIN)[number]) && value !== "TODOS_CNPJS");
      return [...nudge, {
        type: "question", id: id("q-business"), prompt: "Qual o tipo da empresa?",
        choices: [
          ...main.map((value) => ({ id: `business-${value}`, label: BUSINESS_LABEL[value] ?? value, action: local("businessProfile", value) })),
          ...(others.length ? [{ id: "business-other", label: "Outro tipo", hint: others.map((value) => BUSINESS_LABEL[value] ?? value).slice(0, 3).join(", "), action: local("businessMore", "1") }] : []),
          { id: "business-skip", label: "Não sei agora", hint: "Fica como pendência para conferir", action: local("businessProfile", "") },
        ],
      }];
    }
    case "businessMonths":
      return [...nudge, {
        type: "question", id: id("q-months"), prompt: "Há quanto tempo a empresa existe?",
        choices: MONTHS.map((option) => ({ id: `months-${option.id}`, label: option.label, hint: option.hint, action: local("businessMonths", option.id) })),
      }];
    case "accommodation":
      return [...nudge, facetQuestion(id("q-accommodation"), "Enfermaria ou apartamento?", "accommodation", facet?.accommodations ?? [], { Enfermaria: "Quarto coletivo, mais em conta", Apartamento: "Quarto individual", Ambulatorial: "Sem internação" })];
    case "coparticipation":
      return [...nudge, facetQuestion(id("q-copart"), "E a coparticipação?", "coparticipation", facet?.coparticipations ?? [], { "Sem Coparticipação": "Mensalidade maior, sem cobrança por uso", "Coparticipação Total": "Mensalidade menor, paga por uso" })];
    default:
      return [];
  }
}

/** Os outros tipos de empresa, depois de "Outro tipo". */
export function moreBusinessBlocks(facets: GuideFacets, round: number): ChatBlock[] {
  const others = facets.businessProfiles.filter((value) => !BUSINESS_MAIN.includes(value as (typeof BUSINESS_MAIN)[number]) && value !== "TODOS_CNPJS");
  return [{
    type: "question", id: `q-business-more-${round}`, prompt: "Qual destes?",
    choices: others.slice(0, 9).map((value) => ({ id: `business-${value}`, label: BUSINESS_LABEL[value] ?? value, action: local("businessProfile", value) })),
  }];
}

function facetQuestion(id: string, prompt: string, field: string, facets: Facet[], hints: Record<string, string>): ChatBlock {
  const options = facets.filter((facet) => facet.value).sort((a, b) => b.count - a.count).slice(0, 6);
  return {
    type: "question", id, prompt,
    choices: [
      ...options.map((facet) => ({ id: `${field}-${fold(facet.value)}`, label: facet.value, hint: [hints[facet.value], plansHint(facet.count)].filter(Boolean).join(" · "), action: local(field, facet.value) })),
      { id: `${field}-any`, label: "Tanto faz", hint: "Mostro todas as opções", action: local(field, "") },
    ],
  };
}

/** "OAB-RJ - Ordem dos Advogados..." → "OAB-RJ" quando há sigla; senão o nome. */
export function shortEntity(value: string) {
  const [acronym] = value.split(" - ");
  return acronym && acronym.length <= 24 && acronym !== value ? acronym : value;
}

/** Aplica uma resposta "campo:valor". Devolve null para valores que não são respostas desta etapa. */
export function applyGuideChoice(answers: GuideAnswers, raw: string, facets: GuideFacets): GuideAnswers | null {
  const [field, value] = splitChoice(raw);
  switch (field) {
    case "kind":
      return value === "saude" || value === "odonto" ? { kind: value } : null;
    case "audience":
      return value === "PESSOA_FISICA" || value === "ADESAO" || value === "PME_EMPRESARIAL"
        ? { kind: answers.kind, audience: value, city: answers.city, ages: answers.ages }
        : null;
    case "city":
      return facets.cities.includes(value) ? { ...answers, city: value } : null;
    case "entity":
      return { ...answers, entity: value || null };
    case "businessProfile":
      return { ...answers, businessProfile: value || null };
    case "businessMonths": {
      const option = MONTHS.find((item) => item.id === value);
      return option ? { ...answers, businessMonths: option.months } : null;
    }
    case "accommodation":
      return { ...answers, accommodation: value || null };
    case "coparticipation":
      return { ...answers, coparticipation: value || null };
    case "operator":
      return { ...answers, operator: value || null };
    default:
      return null;
  }
}

/** Resposta digitada para a etapa em aberto. */
export function applyGuideText(answers: GuideAnswers, text: string, facets: GuideFacets, round: number): { answers: GuideAnswers } | { blocks: ChatBlock[] } {
  const outcome = readGuideText(answers, text, facets, round);
  if ("answers" in outcome || outcome.blocks.some((block) => block.type === "question")) return outcome;
  // Resposta que não vale: a pergunta volta logo abaixo do aviso (a anterior fechou com a mensagem).
  return { blocks: [...outcome.blocks, ...nextGuideBlocks(answers, facets, round).filter((block) => !block.id.startsWith("a-nudge"))] };
}

function readGuideText(answers: GuideAnswers, text: string, facets: GuideFacets, round: number): { answers: GuideAnswers } | { blocks: ChatBlock[] } {
  const awaiting = guideAwaiting(answers, facets);
  const modality = modalityOf(answers);
  if (awaiting === "city") {
    const match = matchCity(text, facets.cities);
    if ("city" in match) return { answers: { ...answers, city: match.city } };
    if ("error" in match) return { blocks: [{ type: "assistant", id: `a-city-error-${round}`, text: match.error }] };
    return { blocks: [{ type: "question", id: `q-city-pick-${round}`, prompt: "Qual destes?", choices: match.options.map((city) => ({ id: `city-${fold(city)}`, label: city, action: local("city", city) })) }] };
  }
  if (awaiting === "ages") {
    const parsed = parseAges(text);
    if ("error" in parsed) return { blocks: [{ type: "assistant", id: `a-ages-error-${round}`, text: parsed.error }] };
    return { answers: { ...answers, ages: parsed.ages } };
  }
  if (awaiting === "entity" && modality) {
    const match = matchEntity(text, facets.modalities[modality].entities);
    if ("entity" in match) return { answers: { ...answers, entity: match.entity } };
    if ("error" in match) return { blocks: [{ type: "assistant", id: `a-entity-error-${round}`, text: match.error }] };
    return {
      blocks: [{
        type: "question", id: `q-entity-pick-${round}`, prompt: "Qual destas?",
        choices: [
          ...match.options.map((entity, index) => ({ id: `entity-pick-${index}`, label: shortEntity(entity.value), hint: plansHint(entity.count), action: local("entity", entity.value) })),
          { id: "entity-skip", label: "Todas as entidades", action: local("entity", "") },
        ],
      }],
    };
  }
  if (awaiting === "businessMonths") {
    const months = Number((text.match(/\d+/) ?? [""])[0]);
    if (!Number.isFinite(months) || !/\d/.test(text)) return { blocks: [{ type: "assistant", id: `a-months-error-${round}`, text: "Escolha uma das faixas acima ou escreva os meses. Ex.: 18" }] };
    const inMonths = /ano/i.test(text) ? months * 12 : months;
    return { answers: { ...answers, businessMonths: Math.min(2400, inMonths) } };
  }
  return { blocks: [{ type: "assistant", id: `a-free-${round}`, text: "Essa pergunta é por opção. Toque numa delas aqui embaixo." }] };
}

/** O que dá para fazer depois do resultado. */
export function afterResultsBlocks(round: number, options: { more: boolean; filtered: boolean }): ChatBlock[] {
  return [{
    type: "question", id: `q-next-${round}`, prompt: "E agora?",
    choices: [
      ...(options.more ? [{ id: "more", label: "Ver mais 3 planos", action: local("more", "1") }] : []),
      { id: "compare", label: "Comparar os marcados", hint: "Marque até 3 nos cartões", action: local("compare", "1") },
      { id: "operator", label: "Só de uma operadora", action: local("pickOperator", "1") },
      { id: "budget", label: "Definir um teto por mês", action: local("budget", "1") },
      ...(options.filtered ? [{ id: "clear", label: "Tirar os filtros", action: local("clear", "1") }] : []),
      { id: "restart", label: "Refazer a cotação", action: local("restart", "1") },
      { id: "full", label: "Abrir a busca completa", hint: "Todos os filtros num formulário", action: { kind: "href" as const, href: "/cotacao?completo=1" } },
    ],
  }];
}

export function operatorBlocks(answers: GuideAnswers, facets: GuideFacets, round: number): ChatBlock[] {
  const modality = modalityOf(answers);
  const operators = modality ? [...facets.modalities[modality].operators].sort((a, b) => b.count - a.count).slice(0, 8) : [];
  return [{
    type: "question", id: `q-operator-${round}`, prompt: "Qual operadora?",
    choices: [
      ...operators.map((operator) => ({ id: `operator-${operator.value}`, label: operator.label, hint: plansHint(operator.count), action: local("operator", operator.value) })),
      { id: "operator-any", label: "Todas", action: local("operator", "") },
    ],
  }];
}
