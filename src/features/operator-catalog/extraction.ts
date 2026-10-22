import { z } from "zod";

import { DOCUMENT_TYPE_KEYS, QUALIFIER_KEYS, type DocumentType, type ResolvedArea } from "./taxonomy";

/** Text per AI call: a long manual is read in windows and the results are merged. */
export const EXTRACTION_WINDOW_CHARS = 10_000;
/** Bounds the cost of one file (about 120 pages of text). */
export const MAX_EXTRACTION_WINDOWS = 12;

const looseString = z.string().trim().max(2000);
const optionalString = z.union([looseString, z.null()]).optional().catch(undefined);
const qualifiers = z.record(z.string(), z.union([z.string(), z.number()]).transform(String)).optional().catch(undefined);

const factSchema = z.object({
  plan: optionalString,
  area: z.string().trim().min(1).max(60),
  field: z.string().trim().min(1).max(60),
  value: z.union([z.string(), z.number(), z.boolean()]).transform(String).pipe(z.string().trim().min(1).max(2000)),
  unit: optionalString,
  qualifiers,
  page: z.union([z.number().int(), z.null()]).optional().catch(undefined),
  excerpt: optionalString,
});

const priceTableSchema = z.object({
  plan: looseString,
  /** acomodacao, coparticipacao, vidas, regiao, contratacao... */
  qualifiers,
  bands: z.array(z.object({
    band: z.string().trim().min(1).max(40),
    value: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(40)),
  }).passthrough()).max(40).catch([]),
  page: z.union([z.number().int(), z.null()]).optional().catch(undefined),
});

const suggestionSchema = z.object({
  kind: z.enum(["area", "field"]),
  area: z.string().trim().min(1).max(60),
  field: optionalString,
  label: z.string().trim().min(1).max(120),
  description: optionalString,
  example: optionalString,
});

/** What the AI returns for one window of a document. Lenient: a bad item is dropped, not the whole answer. */
export const extractionSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_KEYS).catch("outro"),
  title: looseString.catch(""),
  subject: looseString.catch(""),
  carrier: z.object({ name: z.string().trim().min(1).max(120), ansCode: optionalString }).nullable().catch(null),
  validFrom: optionalString,
  validUntil: optionalString,
  plans: z.array(z.object({ name: z.string().trim().min(1).max(160), code: optionalString, aliases: z.array(z.string().trim().max(160)).optional().catch(undefined) }).passthrough()).catch([]),
  facts: z.array(z.unknown()).catch([]).transform((items) => items.flatMap((item) => {
    const parsed = factSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  })),
  priceTables: z.array(z.unknown()).optional().catch([]).transform((items) => (items ?? []).flatMap((item) => {
    const parsed = priceTableSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  })),
  suggestions: z.array(z.unknown()).optional().catch([]).transform((items) => (items ?? []).flatMap((item) => {
    const parsed = suggestionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  })),
});

export type WindowExtraction = z.infer<typeof extractionSchema>;
export type ExtractedFact = z.infer<typeof factSchema>;
export type ExtractedSuggestion = z.infer<typeof suggestionSchema>;

export type DocumentExtraction = {
  documentType: DocumentType;
  title: string;
  subject: string;
  carrier: { name: string; ansCode?: string | null } | null;
  validFrom: string | null;
  validUntil: string | null;
  plans: Array<{ name: string; code?: string | null; aliases: string[] }>;
  facts: ExtractedFact[];
  suggestions: ExtractedSuggestion[];
};

/** Splits on blank lines without cutting a line, so a table row stays whole in one window. */
export function splitIntoWindows(text: string, maxChars = EXTRACTION_WINDOW_CHARS) {
  const windows: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > maxChars && current.trim()) {
      windows.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line.slice(0, maxChars);
  }
  if (current.trim()) windows.push(current);
  return windows;
}

/**
 * The end of validity the AI read, when it is believable. An end on the import
 * day or before is almost always the print date ("Data da impressão: 22/10/2026"
 * made a coparticipation table expire the day it arrived): it is dropped and the
 * material keeps the validity found at import.
 */
export function plausibleValidUntil(validUntil: Date | null, importedAt: Date) {
  if (!validUntil) return null;
  return validUntil.getTime() > importedAt.getTime() + 2 * 24 * 60 * 60_000 ? validUntil : null;
}

/** A price table becomes one "precos/mensalidade" fact per age band. */
export function expandPriceTables(tables: WindowExtraction["priceTables"]): ExtractedFact[] {
  return tables.flatMap((table) => table.bands.map((band) => ({
    plan: table.plan,
    area: "precos",
    field: "mensalidade",
    value: band.value,
    unit: "BRL",
    qualifiers: { ...(table.qualifiers ?? {}), faixa_etaria: band.band },
    page: table.page ?? undefined,
    excerpt: undefined,
  })));
}

/**
 * Merges the windows of one document: the first window that names the type,
 * operator and dates wins; plans, facts and suggestions are joined, an exact
 * repeat (same plan, area, field, qualifiers and value) is kept once.
 */
export function mergeExtractions(windows: WindowExtraction[]): DocumentExtraction {
  const first = <T>(pick: (window: WindowExtraction) => T | null | undefined, skip?: (value: T) => boolean) => {
    for (const window of windows) {
      const value = pick(window);
      if (value !== null && value !== undefined && !(skip?.(value))) return value;
    }
    return null;
  };
  const plans = new Map<string, { name: string; code?: string | null; aliases: string[] }>();
  for (const window of windows) {
    for (const plan of window.plans) {
      const key = plan.name.toLowerCase();
      const existing = plans.get(key);
      const aliases = [...new Set([...(existing?.aliases ?? []), ...(plan.aliases ?? [])])];
      plans.set(key, { name: existing?.name ?? plan.name, code: existing?.code ?? plan.code ?? null, aliases });
    }
  }
  const seen = new Set<string>();
  const facts: ExtractedFact[] = [];
  for (const fact of windows.flatMap((window) => [...window.facts, ...expandPriceTables(window.priceTables)])) {
    const key = JSON.stringify([fact.plan ?? "", fact.area, fact.field, Object.entries(fact.qualifiers ?? {}).sort(), fact.value]);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
  }
  const suggestionKeys = new Set<string>();
  const suggestions = windows.flatMap((window) => window.suggestions).filter((suggestion) => {
    const key = `${suggestion.kind}|${suggestion.area}|${suggestion.field ?? ""}`;
    if (suggestionKeys.has(key)) return false;
    suggestionKeys.add(key);
    return true;
  });
  return {
    documentType: first((window) => window.documentType, (type) => type === "outro") ?? "outro",
    title: first((window) => window.title, (title) => !title) ?? "",
    subject: first((window) => window.subject, (subject) => !subject) ?? "",
    carrier: first((window) => window.carrier),
    validFrom: first((window) => window.validFrom ?? null),
    validUntil: first((window) => window.validUntil ?? null),
    plans: [...plans.values()],
    facts,
    suggestions,
  };
}

/** The instruction: the catalog's areas and fields, the names already known, and the output shape. */
export function buildExtractionSystemPrompt(input: {
  areas: ResolvedArea[];
  knownCarriers: string[];
  knownPlans: string[];
}) {
  const areas = input.areas.map((area) => {
    const fields = area.fields.map((field) => `    - ${field.key} (${field.type})${field.hint ? `: ${field.hint}` : ""}`).join("\n");
    return `- ${area.slug}: ${area.label}. ${area.description}\n${fields}`;
  }).join("\n");
  return [
    "Você cataloga material de operadoras de plano de saúde para uma corretora no Brasil.",
    "Leia o trecho e devolva SOMENTE um JSON com o formato descrito. Não invente nada: só o que está escrito no trecho.",
    "",
    "Formato:",
    "{",
    `  "documentType": um de ${DOCUMENT_TYPE_KEYS.join(", ")} ("cotacao" quando for uma cotação feita para um cliente, com valores calculados),`,
    '  "title": título curto do material,',
    '  "subject": assunto estável para reconhecer uma nova versão do mesmo material, sem datas (ex.: "tabela pme rj 2 a 29 vidas"),',
    '  "carrier": {"name": nome da operadora, "ansCode": registro ANS ou null} ou null,',
    '  "validFrom" e "validUntil": datas AAAA-MM-DD da vigência escrita no material, ou null. Data de impressão, emissão ou geração do PDF NÃO é vigência,',
    '  "plans": [{"name": nome do plano como no material, "code": código ou null, "aliases": outros nomes do mesmo plano}],',
    '  "priceTables": [{"plan": nome do plano, "qualifiers": {"acomodacao": ..., "coparticipacao": ..., "vidas": ..., "regiao": ..., "contratacao": ...}, "bands": [{"band": "0-18", "value": "123,45"}], "page": número ou null}],',
    '  "facts": [{"plan": nome do plano ou null quando vale para a operadora toda, "area": slug da área, "field": chave do campo, "value": valor como escrito, "unit": unidade ou null, "qualifiers": {...}, "page": número ou null, "excerpt": frase curta de onde veio}],',
    '  "suggestions": [{"kind": "area" ou "field", "area": slug, "field": chave nova ou null, "label": nome em português, "description": para que serve, "example": um valor do material}]',
    "}",
    "",
    "Regras:",
    "- Preços por faixa etária vão SEMPRE em priceTables (uma entrada por combinação de plano e condições), nunca em facts.",
    `- Qualificadores aceitos: ${QUALIFIER_KEYS.join(", ")}. Use para separar valores do mesmo campo (faixa etária, região, acomodação, coparticipação, vidas, cidade).`,
    "- Use as áreas e campos abaixo. Se uma informação importante não couber em nenhum, crie o fato com uma área ou campo novo (slug em minúsculas com _) e registre em suggestions.",
    "- Rede credenciada: um fato por prestador, com cidade e bairro nos qualificadores.",
    "- Valores em reais como escritos (ex.: 1.234,56). Percentuais com %. Prazos em dias com a unidade.",
    "- Em uma cotação, registre os valores calculados como priceTables do plano cotado e promoções ou descontos aplicados em facts da área promocoes.",
    "",
    "Áreas e campos:",
    areas,
    "",
    input.knownCarriers.length ? `Operadoras já catalogadas (use o mesmo nome quando for a mesma): ${input.knownCarriers.join(", ")}` : "",
    input.knownPlans.length ? `Planos já catalogados desta operadora (use o mesmo nome quando for o mesmo): ${input.knownPlans.slice(0, 120).join(", ")}` : "",
  ].filter((line) => line !== "").join("\n");
}
