import "server-only";

import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { executeHybridKnowledgeSearch, type HybridSearchResult } from "@/features/tenant-intelligence/rag/hybrid-retrieval";
import { extractSearchKeywords } from "@/features/tenant-intelligence/rag/search-terms";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { getDatabase, schema } from "@/shared/db";

import { isOperatorKnowledgeQuestion, marketOperatorsInQuestion, NOT_FOUND_MESSAGE, operatorNotImportedMessage, readableMissing, relevantChunks, validateGroundedAnswer } from "./answer-guard";
import { embedQuery } from "./embeddings";
import { toNamedEntity } from "./matching";
import { buildMaterialAsks, questionAreas, type MaterialAsk } from "./material-asks";
import { buildOperatorCard, flattenAnswer, operatorAnswerSchema, stripCitations, type OperatorCard } from "./operator-card";
import { ageBandsInQuestion, agesInQuestion, carriersInQuestion, livesInQuestion, livesQualifierCovers, plansInQuestion } from "./question-scope";
import { applyRerank, fuseRankings } from "./rank-fusion";
import { loadCatalogAreas } from "./service";

const MAX_FACTS = 220;
const MAX_CHUNKS = 6;
/** Candidates the fusion hands to the reranker. */
const MAX_CANDIDATES = 20;
/** The reranker keeps at least this many (completed with the fusion order). */
const MIN_RERANKED = 3;
/** Rewrites of the question searched besides it. */
const MAX_REWRITES = 2;
/** Excerpts when the catalog already covers the subject. */
const LIGHT_CHUNKS = 3;
/** A question asked again within this time is answered from memory (the material rarely changes). */
const answerCache = new TtlCache<OperatorAnswer>(10 * 60_000, 300);
/** Up to this many operators in the catalog, a question that names none searches all of them. */
const MAX_CARRIERS_WITHOUT_NAME = 3;

const SYSTEM_PROMPT = [
  "Você é o assistente de cotação de planos de saúde da corretora.",
  "Sua ÚNICA fonte de conhecimento são as informações catalogadas [F] e os trechos de material [T] desta mensagem.",
  "É proibido usar o que você sabe sobre operadoras, planos, preços, carências, redes ou regras da ANS de fora deste material, mesmo que pareça certo ou óbvio.",
  "Prefira as informações catalogadas [F]: são os dados conferidos do catálogo. Use os trechos [T] para completar.",
  "Cite a origem de cada valor, regra ou prazo entre colchetes, por exemplo [F3] ou [T1]. Toda frase com dado precisa de citação.",
  "Copie números, valores e prazos exatamente como estão no material. A única conta permitida é somar os valores das pessoas de uma cotação; médias e descontos que não estejam escritos são proibidos.",
  "Se o material não responder nada da pergunta, devolva found false e diga em missing o que faltou. Se responder uma parte, devolva found true com essa parte e diga em missing só o que faltou. Não complete com suposições.",
  "Diga a vigência junto do valor quando ela for informada.",
  "Números listados junto de vidas, titular ou dependentes são IDADES (ex.: \"2 vidas 33,24\" = duas pessoas de 33 e 24 anos), não valores em reais. Encontre a faixa etária de cada idade na tabela.",
  "Para várias vidas, mostre o valor de cada pessoa pela faixa (com a citação) e o total somado. Se houver mais de um plano ou acomodação, mostre uma linha por plano.",
  "As tabelas dos trechos [T] podem vir com as colunas desalinhadas pela leitura do PDF: leia com cuidado qual valor é de qual plano e faixa.",
  "Se a pergunta não disser o plano, mostre TODOS os planos da tabela pedida (uma linha por plano e acomodação), em vez de perguntar qual é.",
  "Escolha a tabela pelas condições entre parênteses de cada informação (vidas, contratação, coparticipação, acomodação). Um nome de tabela da pergunta (ex.: Porte I) que não aparece nas condições não impede a resposta: use a quantidade de vidas e as idades, e diga quais condições usou.",
  "Se houver mais de uma tabela que serve (ex.: demais empresas e MEI, ou coparticipação 30% e parcial), mostre cada uma separada, em vez de dizer que não encontrou.",
  "Informações marcadas [preço aguardando aprovação do diretor] podem ser usadas, mas avise na resposta que o preço ainda não foi conferido pelo diretor.",
  "Trechos marcados como leitura automática de imagem podem ter erros: avise para confirmar no material original.",
  "Organize a resposta em seções curtas: uma seção por plano ou tabela (no título, as condições: acomodação, vidas, contratação, coparticipação) ou por grupo (ex.: hospitais por plano). Cada linha tem um rótulo curto (faixa, idade, hospital, regra) e o valor; a citação vai no campo cite da linha, nunca dentro do texto.",
  "Em missing, escreva para o corretor em palavras simples, sem códigos como [F] ou [T] e sem falar em informações catalogadas ou trechos (ex.: tabela de preços da Bradesco).",
  "No máximo 40 linhas somando todas as seções. Uma lista maior (ex.: todos os hospitais) vira as 40 mais relevantes para a pergunta, e em notes diga quantas ficaram de fora.",
  "Em intro, uma frase simples dizendo o que foi encontrado. Em notes, os avisos (preço não conferido, leitura de imagem, condições escolhidas). Sem markdown, sem asteriscos.",
  'Devolva somente um JSON: {"found": true ou false, "intro": "frase", "sections": [{"title": "Amil S380 · QC · 2 vidas · coparticipação 30%", "rows": [{"label": "33 anos (29-33)", "value": "R$ 391,50", "cite": "F2"}, {"label": "Total", "value": "R$ 717,75", "cite": "F1, F2"}]}], "notes": ["aviso"], "missing": "o que não está no material, ou vazio"}.',
].join(" ");

export type OperatorAnswer =
  /** Not imported, not found or not confirmed: the broker is told so, nothing is guessed. */
  | { status: "no_material"; message: string }
  | { status: "answered"; answer: string; sources: Array<{ title: string }>; card: OperatorCard }
  | { status: "error"; message: string };

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(value) : null;
}

async function loadScope(tenantId: string, question: string) {
  const db = getDatabase();
  const [carrierRows, planRows] = await Promise.all([
    db.select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name, metadata: schema.tenantPrivateCarriers.metadata })
      .from(schema.tenantPrivateCarriers)
      .where(and(eq(schema.tenantPrivateCarriers.tenantId, tenantId), isNull(schema.tenantPrivateCarriers.archivedAt))),
    db.select({ id: schema.tenantPrivatePlans.id, name: schema.tenantPrivatePlans.name, code: schema.tenantPrivatePlans.code, metadata: schema.tenantPrivatePlans.metadata, carrierId: schema.tenantPrivatePlans.carrierId, carrierName: schema.tenantPrivateCarriers.name })
      .from(schema.tenantPrivatePlans)
      .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.tenantPrivatePlans.carrierId))
      .where(and(eq(schema.tenantPrivatePlans.tenantId, tenantId), eq(schema.tenantPrivatePlans.active, true), isNull(schema.tenantPrivatePlans.archivedAt))),
  ]);
  const carriers = carriersInQuestion(question, carrierRows.map(toNamedEntity));
  const plans = plansInQuestion(question, planRows.map((row) => ({ ...toNamedEntity(row), carrierName: row.carrierName, carrierId: row.carrierId })))
    .filter((plan) => !carriers.length || carriers.some((carrier) => carrier.id === (plan as { carrierId?: string }).carrierId));
  const carrierIds = [...new Set([...carriers.map((carrier) => carrier.id), ...plans.map((plan) => (plan as { carrierId?: string }).carrierId!).filter(Boolean)])];
  const carrierNames = carrierRows.filter((row) => carrierIds.includes(row.id)).flatMap((row) => [row.name, ...(toNamedEntity(row).aliases ?? [])]);
  // Market operators named in the question with no material in the catalog.
  const entities = carrierRows.map(toNamedEntity);
  const missingOperators = marketOperatorsInQuestion(question).filter((name) => carriersInQuestion(name, entities).length === 0);
  // No operator named and only a few in the catalog: the facts of all of them are searched
  // (22/10: "Planos PME Porte I 2 vidas" never reached the Amil prices). Excerpts keep the
  // operator filter only when one was named.
  const factCarrierIds = carrierIds.length || missingOperators.length || carrierRows.length > MAX_CARRIERS_WITHOUT_NAME
    ? carrierIds
    : carrierRows.map((row) => row.id);
  const ages = agesInQuestion(question);
  const asksPrice = /\b(valor|valores|preco|precos|quanto|mensalidade|tabela|custa|custo)\b/.test(question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  return { carrierIds, factCarrierIds, carrierNames, planIds: plans.map((plan) => plan.id), bands: ageBandsInQuestion(question), ages, lives: livesInQuestion(question), areas: questionAreas(question), asksPrice, missingOperators };
}

/** The active plans of each operator in the catalog, as one fact per operator (same shape as loadFacts). */
async function loadPlanListFacts(tenantId: string, carrierIds: string[]) {
  if (!carrierIds.length) return [];
  const rows = await getDatabase()
    .select({ carrierName: schema.tenantPrivateCarriers.name, planName: schema.tenantPrivatePlans.name })
    .from(schema.tenantPrivatePlans)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.tenantPrivatePlans.carrierId))
    .where(and(
      eq(schema.tenantPrivatePlans.tenantId, tenantId),
      inArray(schema.tenantPrivatePlans.carrierId, carrierIds),
      eq(schema.tenantPrivatePlans.active, true),
      isNull(schema.tenantPrivatePlans.archivedAt),
    ))
    .orderBy(asc(schema.tenantPrivatePlans.name))
    .limit(200);
  const byCarrier = new Map<string, string[]>();
  for (const row of rows) byCarrier.set(row.carrierName, [...(byCarrier.get(row.carrierName) ?? []), row.planName]);
  return [...byCarrier.entries()].map(([carrierName, plans]) => ({
    carrierName,
    planName: null as string | null,
    areaSlug: "planos",
    fieldKey: "planos_cadastrados",
    valueText: plans.join(", "),
    unit: null as string | null,
    qualifiers: {} as unknown,
    validUntil: null as Date | null,
    sourceName: null as string | null,
    pending: false,
  }));
}

/** Price facts of the tables that cover this many lives; other facts stay. No table covers it: all stay. */
function pricesForLives<T extends { areaSlug: string; qualifiers: unknown }>(facts: T[], lives: number) {
  const covers = (fact: T) => fact.areaSlug !== "precos" || livesQualifierCovers((fact.qualifiers as Record<string, string> | null)?.vidas, lives);
  const kept = facts.filter(covers);
  return kept.some((fact) => fact.areaSlug === "precos") ? kept : facts;
}

async function loadFacts(tenantId: string, scope: { factCarrierIds: string[]; planIds: string[]; bands: string[]; asksPrice: boolean; areas: string[] }) {
  if (!scope.factCarrierIds.length) return [];
  const now = new Date();
  // Prices only for the ages asked: a full table would crowd out the rules.
  // A price question with no age brings the table; anything else leaves prices out.
  const priceFilter = scope.bands.length
    ? or(sql`${schema.operatorCatalogFacts.areaSlug} <> 'precos'`, inArray(sql`${schema.operatorCatalogFacts.qualifiers}->>'faixa_etaria'`, scope.bands))
    : scope.asksPrice ? undefined : sql`${schema.operatorCatalogFacts.areaSlug} <> 'precos'`;
  return getDatabase()
    .select({
      carrierName: schema.tenantPrivateCarriers.name,
      planName: schema.tenantPrivatePlans.name,
      areaSlug: schema.operatorCatalogFacts.areaSlug,
      fieldKey: schema.operatorCatalogFacts.fieldKey,
      valueText: schema.operatorCatalogFacts.valueText,
      unit: schema.operatorCatalogFacts.unit,
      qualifiers: schema.operatorCatalogFacts.qualifiers,
      validUntil: schema.operatorCatalogFacts.validUntil,
      sourceName: schema.knowledgeSources.fileName,
      pending: sql<boolean>`${schema.operatorCatalogFacts.status} = 'pending_review'`,
    })
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .leftJoin(schema.knowledgeSources, eq(schema.knowledgeSources.id, schema.operatorCatalogFacts.sourceId))
    .where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      eq(schema.operatorCatalogFacts.origin, "material"),
      inArray(schema.operatorCatalogFacts.carrierId, scope.factCarrierIds),
      or(
        // Approved: only for plans already in the catalog.
        and(eq(schema.operatorCatalogFacts.status, "current"), or(isNull(schema.operatorCatalogFacts.planId), eq(schema.tenantPrivatePlans.active, true))),
        // A price still waiting for the director answers only while no approved price exists
        // for the same plan and conditions (22/10: the first import had every price pending).
        and(
          eq(schema.operatorCatalogFacts.status, "pending_review"),
          eq(schema.operatorCatalogFacts.areaSlug, "precos"),
          sql`not exists (select 1 from operator_catalog_facts approved where approved.tenant_id = ${tenantId} and approved.fact_key = "operator_catalog_facts"."fact_key" and approved.status = 'current')`,
        ),
      ),
      or(sql`${schema.operatorCatalogFacts.validUntil} is null`, sql`${schema.operatorCatalogFacts.validUntil} >= ${now.toISOString()}::timestamptz`),
      scope.planIds.length ? or(inArray(schema.operatorCatalogFacts.planId, scope.planIds), isNull(schema.operatorCatalogFacts.planId)) : undefined,
      // Only the subjects asked (prices, hospitals...): the rest of the catalog made the prompt 15k tokens.
      scope.areas.length ? inArray(schema.operatorCatalogFacts.areaSlug, scope.areas) : undefined,
      priceFilter,
    ))
    // A price question: the prices come first, so the fact limit never cuts them for rules.
    .orderBy(
      ...(scope.asksPrice || scope.bands.length ? [sql`case when ${schema.operatorCatalogFacts.areaSlug} = 'precos' then 0 else 1 end`] : []),
      asc(schema.tenantPrivatePlans.name),
      asc(schema.operatorCatalogFacts.areaSlug),
    )
    .limit(MAX_FACTS);
}

const REWRITE_PROMPT = [
  "Você reescreve a pergunta de um corretor de planos de saúde em até 3 buscas curtas para achar o trecho certo no material das operadoras (tabelas de preço, carências, rede, reembolso, regras de contratação).",
  "Use as palavras que esses materiais usam (ex.: faixa etária, Porte I, coparticipação, enfermaria, apartamento, carência, PME, adesão).",
  "Idades citadas viram a faixa etária da tabela (ex.: 33 anos = faixa 29-33).",
  "Não invente operadora, plano ou valor que não estejam na pergunta.",
  'Devolva somente um JSON: {"queries": ["busca 1", "busca 2"]}.',
].join(" ");

const RERANK_PROMPT = [
  "Você ordena trechos de material de operadoras de saúde pela utilidade para responder a pergunta de um corretor.",
  "Devolva os números dos trechos que ajudam a responder, do mais útil para o menos útil, no máximo 6. Deixe de fora os que não ajudam.",
  "Um trecho com as linhas da tabela pedida vale mais do que um trecho só com o título da tabela.",
  'Devolva somente um JSON: {"order": [3, 1, 5]}.',
].join(" ");

/**
 * Other ways to search the same question, in the words of the material (Fase 1, 23/10):
 * "quanto fica pra 2 pessoas de 33 e 24" also searches "tabela PME faixa etária 29-33".
 * Failure or slowness only means searching with the question alone.
 */
async function rewriteQuestion(input: { tenantId: string; userId: string; question: string }) {
  const result = await runGateway({
    profile: "json-structured",
    purpose: "cotacao_express_busca",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    temperature: 0,
    maxTokens: 300,
    timeoutMs: 3_000,
    maxAttempts: 1,
    schema: z.object({ queries: z.array(z.string().trim().max(200)).max(3).catch([]) }),
    messages: [
      { role: "system", content: REWRITE_PROMPT },
      { role: "user", content: input.question },
    ],
  }).catch(() => null);
  if (!result?.ok) return [];
  const own = input.question.trim().toLowerCase();
  return result.value.queries.filter((query) => query.length >= 3 && query.toLowerCase() !== own).slice(0, MAX_REWRITES);
}

/** One query, searched by term and by meaning: two rankings for the fusion. */
async function searchQuery(tenantId: string, query: string, carrierIds: string[]) {
  const embedding = await embedQuery(query).catch(() => null);
  const base = { tenantId, query, category: OPERATOR_MATERIAL_CATEGORY, carrierIds, limit: MAX_CANDIDATES };
  return Promise.all([
    executeHybridKnowledgeSearch(base),
    embedding ? executeHybridKnowledgeSearch({ ...base, queryEmbedding: embedding }) : Promise.resolve([] as HybridSearchResult[]),
  ]);
}

/**
 * The model reads the best candidates and keeps the ones that answer the question, in order.
 * Failure keeps the fusion order.
 */
async function rerankChunks(input: { tenantId: string; userId: string; question: string; candidates: HybridSearchResult[] }) {
  if (input.candidates.length <= MAX_CHUNKS) return input.candidates;
  const excerpts = input.candidates.map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.text.slice(0, 700)}`).join("\n\n");
  const result = await runGateway({
    profile: "json-structured",
    purpose: "cotacao_express_ordem",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    temperature: 0,
    maxTokens: 500,
    timeoutMs: 5_000,
    maxAttempts: 1,
    schema: z.object({ order: z.array(z.coerce.number()).max(MAX_CANDIDATES).catch([]) }),
    messages: [
      { role: "system", content: RERANK_PROMPT },
      { role: "user", content: `Pergunta: ${input.question}\n\nTrechos:\n${excerpts}` },
    ],
  }).catch(() => null);
  const fallback = input.candidates.slice(0, MAX_CHUNKS);
  if (!result?.ok) return fallback;
  const picked = applyRerank(input.candidates, result.value.order, MAX_CHUNKS);
  // Too few kept: complete with the fusion order, the guards still filter afterwards.
  for (const chunk of fallback) {
    if (picked.length >= MIN_RERANKED) break;
    if (!picked.includes(chunk)) picked.push(chunk);
  }
  return picked;
}

/**
 * Fase 1 (23/10): the question and its rewrites, each searched by term and by meaning,
 * merged by reciprocal rank fusion; the best candidates are reranked by the model.
 */
async function loadChunks(input: { tenantId: string; userId: string; question: string; carrierIds: string[]; light?: boolean }): Promise<HybridSearchResult[]> {
  // The catalog already has the subject (prices, hospitals...): the excerpts only complete
  // it, so no rewrites and no rerank (23/10: ~8 s of the 30 s were spent here).
  if (input.light) {
    const own = await searchQuery(input.tenantId, input.question, input.carrierIds);
    const top = fuseRankings(own, LIGHT_CHUNKS);
    if (!top.length && input.carrierIds.length) return loadChunks({ ...input, carrierIds: [] });
    return withFollowingText(input.tenantId, top);
  }
  const [own, rewrites] = await Promise.all([
    searchQuery(input.tenantId, input.question, input.carrierIds),
    rewriteQuestion(input),
  ]);
  const others = await Promise.all(rewrites.map((query) => searchQuery(input.tenantId, query, input.carrierIds).catch(() => [] as HybridSearchResult[][])));
  // The question itself counts twice: a rewrite should add, never drown it.
  const candidates = fuseRankings([...own, ...own, ...others.flat()], MAX_CANDIDATES);
  // Material not catalogued yet has no operator tag: without results, search it all.
  if (!candidates.length && input.carrierIds.length) return loadChunks({ ...input, carrierIds: [] });
  const ranked = await rerankChunks({ ...input, candidates });
  return withFollowingText(input.tenantId, ranked);
}

/**
 * A price table is cut across chunks: its title ("Porte I - 2 vidas") matches the
 * question and its rows sit in the next chunk. Each excerpt carries the next
 * chunk of the same document so the model sees the rows (22/10).
 */
async function withFollowingText(tenantId: string, chunks: HybridSearchResult[]) {
  if (!chunks.length) return chunks;
  const rows = await getDatabase().execute(sql`
    select current_chunk.id as chunk_id, next_chunk.text as next_text
    from knowledge_chunks current_chunk
    join knowledge_chunks next_chunk
      on next_chunk.document_id = current_chunk.document_id and next_chunk.chunk_index = current_chunk.chunk_index + 1
    where current_chunk.tenant_id = ${tenantId}
      and current_chunk.id in (${sql.join(chunks.map((chunk) => sql`${chunk.chunkId}`), sql`, `)})
  `);
  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{ chunk_id: string; next_text: string }>;
  const nextById = new Map(list.map((row) => [row.chunk_id, row.next_text]));
  return chunks.map((chunk) => (nextById.has(chunk.chunkId) ? { ...chunk, text: `${chunk.text}\n${nextById.get(chunk.chunkId)}` } : chunk));
}

function blocked(message: string, log: Record<string, unknown>): OperatorAnswer {
  console.info("[cotacao-express] blocked", log);
  return { status: "no_material", message };
}

/**
 * Answers a broker's question about operators ONLY from the imported material,
 * with guards before and after the model:
 * 1. an operator named in the question with no material imported is refused;
 * 2. only facts and excerpts of the operator asked, close to the question, go to the model;
 * 3. nothing relevant found: "not imported yet", and the model is not called;
 * 4. the model answers found/missing and cites [F]/[T] for every data point;
 * 5. an answer without a valid citation, or with a number that is not in the
 *    material or in the question, is blocked instead of shown.
 */
export async function answerOperatorQuestion(input: { tenantId: string; userId: string; question: string }): Promise<OperatorAnswer> {
  const key = `${input.tenantId}|${input.question.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  return answerCache.getOrLoad(key, () => computeOperatorAnswer(input), (answer) => answer.status === "answered");
}

async function computeOperatorAnswer(input: { tenantId: string; userId: string; question: string }): Promise<OperatorAnswer> {
  const scope = await loadScope(input.tenantId, input.question);
  if (scope.missingOperators.length && !scope.carrierIds.length) {
    return blocked(operatorNotImportedMessage(scope.missingOperators), { reason: "operator_not_imported", operators: scope.missingOperators });
  }
  const areasPromise = loadCatalogAreas(input.tenantId);
  // Facts first (one fast query): when they cover the subject asked, the excerpt search is light.
  let allFacts = await loadFacts(input.tenantId, scope);
  if (!allFacts.length && scope.areas.length) allFacts = await loadFacts(input.tenantId, { ...scope, areas: [] });
  // No price for the bands asked (a table written "24 a 28", or other bands): the whole table
  // goes and the model finds each age in it (24/10, KLINI 200 AD).
  if (scope.bands.length && !allFacts.some((fact) => fact.areaSlug === "precos")) {
    const table = await loadFacts(input.tenantId, { ...scope, bands: [], asksPrice: true, areas: ["precos"] });
    allFacts = [...allFacts, ...table];
  }
  // "Quais os planos da X": the plans the catalog has for the operator are an answer too.
  if (scope.areas.includes("planos")) allFacts = [...(await loadPlanListFacts(input.tenantId, scope.factCarrierIds)), ...allFacts];
  const covered = scope.areas.length > 0 && allFacts.some((fact) => scope.areas.includes(fact.areaSlug));
  const [rawChunks, areas] = await Promise.all([
    loadChunks({ tenantId: input.tenantId, userId: input.userId, question: input.question, carrierIds: scope.carrierIds, light: covered }),
    areasPromise,
  ]);
  // "2 vidas" keeps only the price tables for 2 lives (23/10: the 3 a 4 and 30 a 99 vidas
  // tables sat next to the 2 vidas one and the model refused to pick).
  const facts = scope.lives ? pricesForLives(allFacts, scope.lives) : allFacts;
  const chunks = relevantChunks(rawChunks, { carrierIds: scope.carrierIds, carrierNames: scope.carrierNames, keywordCount: extractSearchKeywords(input.question).length });
  if (!facts.length && !chunks.length) {
    const extra = scope.missingOperators.length ? ` ${operatorNotImportedMessage(scope.missingOperators)}` : "";
    return blocked(`${NOT_FOUND_MESSAGE}${extra}`, { reason: "nothing_relevant", rawChunks: rawChunks.length });
  }

  const label = (areaSlug: string, fieldKey: string) => {
    const area = areas.find((item) => item.slug === areaSlug);
    return `${area?.label ?? areaSlug} / ${area?.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey}`;
  };
  const factLines = facts.map((fact, index) => {
    const qualifiers = Object.entries((fact.qualifiers ?? {}) as Record<string, string>).map(([key, value]) => `${key}: ${value}`).join(", ");
    const until = formatDate(fact.validUntil);
    const flag = fact.pending ? " [preço aguardando aprovação do diretor]" : "";
    return `[F${index + 1}]${flag} ${fact.carrierName}${fact.planName ? ` · ${fact.planName}` : ""} · ${label(fact.areaSlug, fact.fieldKey)}${qualifiers ? ` (${qualifiers})` : ""} = ${fact.valueText}${until ? ` · válido até ${until}` : ""}${fact.sourceName ? ` · fonte: ${fact.sourceName}` : ""}`;
  });
  const chunkLines = chunks.map((chunk, index) => {
    const until = formatDate(chunk.validUntil);
    return `[T${index + 1}] ${chunk.title}${until ? ` (válido até ${until})` : ""}\n${chunk.text}`;
  });
  const context = `Informações catalogadas:\n${factLines.join("\n") || "(nenhuma)"}\n\nTrechos de material:\n${chunkLines.join("\n\n") || "(nenhum)"}`;

  const people = `${scope.lives ? `\nQuantidade de vidas: ${scope.lives}.` : ""}${scope.ages.length ? `\nIdades das pessoas: ${scope.ages.join(", ")} anos.` : ""}`;
  const result = await runGateway({
    profile: "chat-smart",
    purpose: "cotacao_express",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    temperature: 0,
    maxTokens: 5_000,
    timeoutMs: 60_000,
    schema: operatorAnswerSchema,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pergunta: ${input.question}${people}\n\n${context}` },
    ],
  });
  if (!result.ok) {
    return { status: "error", message: result.reason === "rate_limited" ? "Muitas consultas seguidas. Tente de novo em um minuto." : "Não foi possível consultar a IA agora. Tente novamente em instantes." };
  }
  const missingText = readableMissing(result.value.missing);
  const answerText = flattenAnswer(result.value);
  if (!result.value.found || !answerText) {
    const missing = missingText ? ` Faltou no material: ${missingText}.` : "";
    return blocked(`${NOT_FOUND_MESSAGE}${missing}`, { reason: "model_not_found" });
  }
  const validIds = new Set([...factLines.map((_, index) => `F${index + 1}`), ...chunkLines.map((_, index) => `T${index + 1}`)]);
  const verdict = validateGroundedAnswer({ answer: answerText, validIds, context, question: input.question });
  if (!verdict.ok) {
    return blocked(
      "Não consegui confirmar essa resposta no material importado, então não vou responder para não passar informação errada. Confira o material em Ferramentas › Materiais das operadoras ou pergunte de outro jeito.",
      { reason: verdict.reason, detail: verdict.detail, model: result.model.model },
    );
  }
  const sourceById = new Map<string, string>([
    ...facts.map((fact, index) => [`F${index + 1}`, fact.sourceName ?? `Catálogo ${fact.carrierName}`] as [string, string]),
    ...chunks.map((chunk, index) => [`T${index + 1}`, chunk.title] as [string, string]),
  ]);
  const card = buildOperatorCard(result.value, sourceById, missingText ?? null);
  const partial = missingText ? `\n\nNão está no material importado: ${missingText}.` : "";
  // The broker sees no [F1]/[T2] nor file names (Vinicios, 23/10); the guard above already checked them.
  return { status: "answered", answer: `${stripCitations(answerText)}${partial}`, sources: card.sources.map((title) => ({ title })), card };
}

/** Last user text of a chat request (AI SDK UI messages carry "parts", older ones "content"). */
export function lastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: string; content?: unknown; parts?: Array<{ type?: string; text?: string }> };
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.parts)) return message.parts.filter((part) => part?.type === "text").map((part) => part.text ?? "").join(" ");
    return "";
  }
  return "";
}

/**
 * For every assistant of the system: a question about an operator or a plan's
 * content is answered only by the guarded catalog answer, never by a free
 * model. Returns null when the question is about something else.
 */
export async function answerIfOperatorQuestion(input: { tenantId: string; userId: string; question: string; ragEnabled?: boolean }): Promise<string | null> {
  const reply = await operatorQuestionReply(input);
  return reply ? reply.text : null;
}

/**
 * What the material of this company covers, for questions ready to tap (Jack, 23/10):
 * current facts per operator, plan and area.
 */
export async function loadMaterialAsks(tenantId: string, options: { seed: number; limit: number; focusCarrier?: string | null; excludeAreas?: string[] }): Promise<MaterialAsk[]> {
  const rows = await getDatabase()
    .select({
      carrierName: schema.tenantPrivateCarriers.name,
      planName: schema.tenantPrivatePlans.name,
      areaSlug: schema.operatorCatalogFacts.areaSlug,
      facts: sql<number>`count(*)::int`,
    })
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      eq(schema.operatorCatalogFacts.origin, "material"),
      eq(schema.operatorCatalogFacts.status, "current"),
      isNull(schema.tenantPrivateCarriers.archivedAt),
      or(isNull(schema.operatorCatalogFacts.planId), eq(schema.tenantPrivatePlans.active, true)),
      or(sql`${schema.operatorCatalogFacts.validUntil} is null`, sql`${schema.operatorCatalogFacts.validUntil} >= ${new Date().toISOString()}::timestamptz`),
    ))
    .groupBy(schema.tenantPrivateCarriers.name, schema.tenantPrivatePlans.name, schema.operatorCatalogFacts.areaSlug)
    .limit(300);
  return buildMaterialAsks(rows.map((row) => ({ ...row, facts: Number(row.facts) })), options);
}

function daySeed(now = new Date()) {
  return Math.floor(now.getTime() / 86_400_000);
}

/** Questions of the day for the Jack's first screen. */
export async function materialAsksOfTheDay(tenantId: string, limit = 3) {
  return loadMaterialAsks(tenantId, { seed: daySeed(), limit }).catch(() => [] as MaterialAsk[]);
}

/** Same as answerIfOperatorQuestion, with the answer as a card and what to ask next (the Jack draws them). */
export async function operatorQuestionReply(input: { tenantId: string; userId: string; question: string; ragEnabled?: boolean }): Promise<{ text: string; card?: OperatorCard; followUps?: MaterialAsk[]; otherOperators?: boolean } | null> {
  const question = input.question.trim().slice(0, 500);
  if (question.length < 3) return null;
  const carriers = await getDatabase().select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name, metadata: schema.tenantPrivateCarriers.metadata })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, input.tenantId), isNull(schema.tenantPrivateCarriers.archivedAt)));
  if (!isOperatorKnowledgeQuestion(question, carriers.map((carrier) => carrier.name))) return null;
  // Outside the pilot the assistant still never answers about operators from its own memory.
  if (input.ragEnabled === false) return { text: "A consulta de operadoras, planos e preços aqui no assistente ainda está em teste. Por enquanto, use a Cotação Express ou fale com a sua gestão." };
  const focusCarrier = carriersInQuestion(question, carriers.map(toNamedEntity))[0]?.name ?? null;
  const followUpsPromise = loadMaterialAsks(input.tenantId, { seed: daySeed(), limit: 3, focusCarrier, excludeAreas: questionAreas(question) }).catch(() => [] as MaterialAsk[]);
  const result = await answerOperatorQuestion({ ...input, question }).catch((): OperatorAnswer => ({ status: "error", message: "Não foi possível consultar o material das operadoras agora. Tente novamente em instantes." }));
  // Next questions: the same operator, other subjects with material (or any operator when none was named).
  let followUps = await followUpsPromise;
  // The operator asked has nothing else in the material: what the material has, from any operator.
  const otherOperators = Boolean(focusCarrier) && !followUps.length;
  if (otherOperators) followUps = await loadMaterialAsks(input.tenantId, { seed: daySeed(), limit: 3 }).catch(() => [] as MaterialAsk[]);
  if (result.status !== "answered") return { text: result.message, followUps, otherOperators };
  return { text: result.answer, card: result.card, followUps, otherOperators };
}
