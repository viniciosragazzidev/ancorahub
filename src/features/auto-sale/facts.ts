/**
 * Fatos do cliente para cotar (§4 do plano): vêm do que a qualificação já coletou, para o agente
 * confirmar em vez de repetir perguntas. Puro: tolerante às chaves configuráveis da qualificação.
 */
import type { QuoteInput } from "@/features/global-catalog/pilot/contracts";
import { parseAges, parseBudget } from "@/features/global-catalog/pilot/guide/guide-flow";

import { dealFactsSchema, type DealFacts } from "./contracts";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

type Bag = Record<string, unknown>;

function pick(bags: readonly Bag[], keys: readonly string[]): unknown {
  for (const bag of bags) {
    for (const [key, value] of Object.entries(bag)) {
      if (keys.includes(fold(key)) && value !== null && value !== undefined && value !== "") return value;
    }
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "value" in value) return asText((value as { value: unknown }).value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ") || undefined;
  return undefined;
}

/** Resposta solta gravada como cidade na qualificação ("Só para mim", "Sim", "2 pessoas") não vira cidade (12/11, caso Alex). */
const NOT_A_CITY = /\b(para|pra|mim|eu|so|somente|apenas|sim|nao|familia|esposa|marido|filho|filha|filhos|vida|vidas|pessoa|pessoas|anos|plano|quero|individual|empresa)\b/;

export function plausibleCity(text: string) {
  const value = fold(text);
  if (!value || value.length > 60 || /\d/.test(value)) return false;
  if (value.split(/\s+/).length > 5) return false;
  return !NOT_A_CITY.test(value);
}

export function modalityFromText(text: string | undefined): DealFacts["modality"] {
  const value = fold(text ?? "");
  if (!value) return undefined;
  if (/(cnpj|mei|empresa|pme|empresarial)/.test(value)) return "PME_EMPRESARIAL";
  if (/(adesao|entidade|profiss|sindicato|conselho|oab|crea)/.test(value)) return "ADESAO";
  if (/(pf|pessoa fisica|individual|familiar|cpf)/.test(value)) return "PESSOA_FISICA";
  return undefined;
}

export function coparticipationFromText(text: string | undefined): DealFacts["coparticipation"] {
  const value = fold(text ?? "");
  if (!value) return undefined;
  if (/(sem|nao quero|zero) ?(co.?part)/.test(value) || value === "sem") return "sem";
  if (/parcial/.test(value)) return "parcial";
  if (/(com|total) ?co.?part/.test(value) || value === "com") return "total";
  if (/(tanto faz|indiferente|qualquer)/.test(value)) return "indiferente";
  return undefined;
}

/** Junta os dados da qualificação (sessão, detalhes do lead) num conjunto de fatos validado. */
export function factsFromQualification(input: {
  nome: string;
  tipo: string | null;
  livesCount: number | null;
  collectedData: unknown;
  qualificationDetails: unknown;
  formData: unknown;
}): DealFacts {
  const bags = [input.collectedData, input.qualificationDetails, input.formData].filter((bag): bag is Bag => Boolean(bag) && typeof bag === "object" && !Array.isArray(bag));
  const facts: DealFacts = {};
  const first = input.nome.trim().split(/\s+/)[0];
  if (first && first.length <= 60) facts.firstName = first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
  const city = asText(pick(bags, ["city", "cidade", "municipio"]));
  if (city && plausibleCity(city)) facts.city = city.slice(0, 120);
  const neighborhood = asText(pick(bags, ["bairro", "neighborhood", "regiao"]));
  if (neighborhood) facts.neighborhood = neighborhood.slice(0, 120);
  const agesRaw = pick(bags, ["ages", "idades", "idade", "faixa_etaria"]);
  const agesText = Array.isArray(agesRaw) ? agesRaw.join(", ") : asText(agesRaw);
  if (agesText) {
    const parsed = parseAges(agesText);
    if ("ages" in parsed && parsed.ages.length <= 30) facts.ages = parsed.ages;
  }
  const modality = modalityFromText(asText(pick(bags, ["modality", "modalidade", "tipo_plano", "tipo", "perfil"])) ?? input.tipo ?? undefined);
  if (modality) facts.modality = modality;
  const cnpj = asText(pick(bags, ["cnpj", "mei", "tem_cnpj"]));
  if (cnpj) facts.hasCnpj = !/^(nao|n|no|false)$/.test(fold(cnpj));
  const businessProfile = businessProfileFromText(asText(pick(bags, ["tipo_empresa", "porte", "perfil_empresa", "cnpj", "mei"])));
  if (businessProfile) facts.businessProfile = businessProfile;
  const entity = asText(pick(bags, ["entidade", "profissao", "profession", "entity"]));
  if (entity) facts.entity = entity.slice(0, 200);
  const product = fold(asText(pick(bags, ["produto", "tipo_plano", "plano"])) ?? "");
  if (/odonto|dental/.test(product) && !/saude/.test(product)) facts.product = "odonto";
  const budget = asText(pick(bags, ["budget", "orcamento", "valor_mensal", "quanto_pode_pagar"]));
  if (budget) {
    // "600 por pessoa", "até R$ 1.500": o parser do guia quer só o valor.
    const parsed = parseBudget(budget.match(/r?\$?\s*\d[\d.]*(?:,\d{1,2})?\s*(?:mil)?/i)?.[0] ?? budget);
    if ("cents" in parsed && parsed.cents <= 99_999_999) facts.budgetCents = parsed.cents;
    if (/(por pessoa|por vida|cada)/.test(fold(budget))) facts.budgetBasis = "per_person";
  }
  const copart = coparticipationFromText(asText(pick(bags, ["coparticipacao", "coparticipation"])));
  if (copart) facts.coparticipation = copart;
  const hospital = asText(pick(bags, ["hospital", "hospital_preferencia", "laboratorio"]));
  if (hospital) facts.hospital = hospital.slice(0, 160);
  const currentPlan = asText(pick(bags, ["plano_atual", "current_plan", "operadora_atual"]));
  if (currentPlan) facts.currentPlan = currentPlan.slice(0, 160);
  const currentPrice = asText(pick(bags, ["valor_atual", "quanto_paga", "current_price"]));
  if (currentPrice) {
    const parsedPrice = parseBudget(currentPrice.match(/r?\$?\s*\d[\d.]*(?:,\d{1,2})?/i)?.[0] ?? currentPrice);
    if ("cents" in parsedPrice) facts.currentPriceCents = parsedPrice.cents;
  }
  const parsed = dealFactsSchema.safeParse(facts);
  return parsed.success ? parsed.data : {};
}

/** Funde fatos novos (do agente ou do gestor) sem apagar os já confirmados com vazio. */
export function mergeFacts(current: DealFacts, update: Partial<DealFacts>): DealFacts {
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    merged[key] = value;
  }
  // O modelo pode escrever "microempresa" ou "ltda": guarda o código do catálogo.
  if (typeof update.businessProfile === "string") merged.businessProfile = businessProfileFromText(update.businessProfile) ?? update.businessProfile.toUpperCase().slice(0, 60);
  const parsed = dealFactsSchema.safeParse(merged);
  return parsed.success ? parsed.data : current;
}

export type MissingFact = "city" | "ages" | "modality" | "entity" | "businessProfile" | "businessMonths";

/** Perfil de empresa dito pelo cliente no código do catálogo (MEI, ME, EPP, LTDA, S_A, EI). */
export function businessProfileFromText(text: string | undefined): string | undefined {
  const value = fold(text ?? "").replace(/[.\s/]/g, "");
  if (!value) return undefined;
  if (/^(mei|microempreendedor)/.test(value)) return "MEI";
  if (/^(epp|empresadepequenoporte)/.test(value)) return "EPP";
  if (/^(me|microempresa)$/.test(value) || value.startsWith("microempresa")) return "ME";
  if (/^ltda|limitada/.test(value)) return "LTDA";
  if (/^(sa|sociedadeanonima)$/.test(value)) return "S_A";
  if (/^(ei|empresarioindividual)/.test(value)) return "EI";
  return undefined;
}

/**
 * O que falta para cotar, na ordem em que o agente pergunta. Adesão precisa da profissão ou entidade;
 * PME, do tipo de empresa e do tempo de CNPJ (os planos mudam por perfil e tempo).
 */
export function missingForQuote(facts: DealFacts): MissingFact[] {
  const missing: MissingFact[] = [];
  if (!facts.ages?.length) missing.push("ages");
  if (!facts.city) missing.push("city");
  if (!facts.modality) missing.push("modality");
  if (facts.modality === "ADESAO" && !facts.entity) missing.push("entity");
  if (facts.modality === "PME_EMPRESARIAL" && !facts.businessProfile) missing.push("businessProfile");
  if (facts.modality === "PME_EMPRESARIAL" && facts.businessMonths === undefined) missing.push("businessMonths");
  return missing;
}

/** Orçamento comparável ao total do `simulate`: por pessoa vezes o número de vidas. */
export function totalBudgetCents(facts: DealFacts): number | null {
  if (facts.budgetCents === undefined) return null;
  return facts.budgetBasis === "per_person" ? facts.budgetCents * Math.max(1, facts.ages?.length ?? 1) : facts.budgetCents;
}

/** Modalidade do catálogo: saúde ou só odonto (`*_ODONTO`), em PF, adesão ou PME. */
export function catalogModality(facts: DealFacts): QuoteInput["modality"] | null {
  if (!facts.modality) return null;
  return (facts.product === "odonto" ? `${facts.modality}_ODONTO` : facts.modality) as QuoteInput["modality"];
}

/** Monta o QuoteInput do cotador. null enquanto faltar dado obrigatório. A entidade já vem resolvida no catálogo. */
export function quoteInputFromFacts(facts: DealFacts): QuoteInput | null {
  if (missingForQuote(facts).length) return null;
  const ages = facts.ages!;
  const pme = facts.modality === "PME_EMPRESARIAL";
  return {
    modality: catalogModality(facts)!,
    city: facts.city!,
    lives: ages.map((age, index) => ({ age, holder: index === 0, relationship: index === 0 ? "Titular" : "Dependente" })),
    operator: "",
    administrator: "",
    profession: "",
    entity: facts.modality === "ADESAO" ? facts.entity ?? "" : "",
    businessProfile: pme ? facts.businessProfile ?? "" : "",
    businessMonths: pme ? facts.businessMonths ?? null : null,
    accommodation: "",
    // O filtro do catálogo usa o texto exato da operadora; a preferência entra na ordenação (offer-strategy).
    coparticipation: "",
    coverage: "",
    // Saúde com odonto incluso: só planos com odonto. Só odonto já é a modalidade *_ODONTO.
    dental: facts.product !== "odonto" && facts.dentalIncluded ? "yes" : "",
    query: "",
    budgetCents: totalBudgetCents(facts),
    includeIncompatible: false,
    page: 1,
  };
}
