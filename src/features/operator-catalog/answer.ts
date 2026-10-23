import "server-only";

import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { executeHybridKnowledgeSearch, type HybridSearchResult } from "@/features/tenant-intelligence/rag/hybrid-retrieval";
import { extractSearchKeywords } from "@/features/tenant-intelligence/rag/search-terms";
import { getDatabase, schema } from "@/shared/db";

import { isOperatorKnowledgeQuestion, marketOperatorsInQuestion, NOT_FOUND_MESSAGE, operatorNotImportedMessage, relevantChunks, validateGroundedAnswer } from "./answer-guard";
import { embedQuery } from "./embeddings";
import { toNamedEntity } from "./matching";
import { ageBandsInQuestion, agesInQuestion, carriersInQuestion, plansInQuestion } from "./question-scope";
import { loadCatalogAreas } from "./service";

const MAX_FACTS = 220;
const MAX_CHUNKS = 6;
/** Up to this many operators in the catalog, a question that names none searches all of them. */
const MAX_CARRIERS_WITHOUT_NAME = 3;

const SYSTEM_PROMPT = [
  "Você é o assistente de cotação de planos de saúde da corretora.",
  "Sua ÚNICA fonte de conhecimento são as informações catalogadas [F] e os trechos de material [T] desta mensagem.",
  "É proibido usar o que você sabe sobre operadoras, planos, preços, carências, redes ou regras da ANS de fora deste material, mesmo que pareça certo ou óbvio.",
  "Prefira as informações catalogadas [F]: são os dados conferidos do catálogo. Use os trechos [T] para completar.",
  "Cite a origem de cada valor, regra ou prazo entre colchetes, por exemplo [F3] ou [T1]. Toda frase com dado precisa de citação.",
  "Copie números, valores e prazos exatamente como estão no material. Não calcule totais, médias ou descontos que não estejam escritos.",
  "Se o material não responder a pergunta (ou responder só em parte), devolva found false e diga em missing o que faltou. Não complete com suposições.",
  "Diga a vigência junto do valor quando ela for informada.",
  "Números listados junto de vidas, titular ou dependentes são IDADES (ex.: \"2 vidas 33,24\" = duas pessoas de 33 e 24 anos), não valores em reais. Encontre a faixa etária de cada idade na tabela.",
  "Para várias vidas, mostre o valor de cada pessoa pela faixa (com a citação) e o total somado. Se houver mais de um plano ou acomodação, mostre uma linha por plano.",
  "As tabelas dos trechos [T] podem vir com as colunas desalinhadas pela leitura do PDF: leia com cuidado qual valor é de qual plano e faixa.",
  "Se a pergunta não disser o plano, mostre TODOS os planos da tabela pedida (uma linha por plano e acomodação), em vez de perguntar qual é.",
  "Informações marcadas [preço aguardando aprovação do diretor] podem ser usadas, mas avise na resposta que o preço ainda não foi conferido pelo diretor.",
  "Trechos marcados como leitura automática de imagem podem ter erros: avise para confirmar no material original.",
  'Devolva somente um JSON: {"found": true ou false, "answer": "resposta com citações", "missing": "o que não está no material, ou vazio"}.',
].join(" ");

export type OperatorAnswer =
  /** Not imported, not found or not confirmed: the broker is told so, nothing is guessed. */
  | { status: "no_material"; message: string }
  | { status: "answered"; answer: string; sources: Array<{ title: string }> }
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
  return { carrierIds, factCarrierIds, carrierNames, planIds: plans.map((plan) => plan.id), bands: ageBandsInQuestion(question), ages, asksPrice, missingOperators };
}

async function loadFacts(tenantId: string, scope: { factCarrierIds: string[]; planIds: string[]; bands: string[]; asksPrice: boolean }) {
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
      priceFilter,
    ))
    .orderBy(asc(schema.tenantPrivatePlans.name), asc(schema.operatorCatalogFacts.areaSlug))
    .limit(MAX_FACTS);
}

/** Term search and meaning search, merged: a chunk found by both keeps the better score. */
async function loadChunks(tenantId: string, question: string, carrierIds: string[]): Promise<HybridSearchResult[]> {
  const embedding = await embedQuery(question).catch(() => null);
  const base = { tenantId, query: question, category: OPERATOR_MATERIAL_CATEGORY, carrierIds, limit: MAX_CHUNKS };
  const [byTerm, byMeaning] = await Promise.all([
    executeHybridKnowledgeSearch(base),
    embedding ? executeHybridKnowledgeSearch({ ...base, queryEmbedding: embedding }) : Promise.resolve([] as HybridSearchResult[]),
  ]);
  const merged = new Map<string, HybridSearchResult>();
  for (const chunk of [...byTerm, ...byMeaning]) {
    const known = merged.get(chunk.chunkId);
    if (!known || chunk.score > known.score) merged.set(chunk.chunkId, chunk);
  }
  const ranked = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, MAX_CHUNKS);
  // Material not catalogued yet has no operator tag: without results, search it all.
  if (!ranked.length && carrierIds.length) return loadChunks(tenantId, question, []);
  return withFollowingText(tenantId, ranked);
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
  const scope = await loadScope(input.tenantId, input.question);
  if (scope.missingOperators.length && !scope.carrierIds.length) {
    return blocked(operatorNotImportedMessage(scope.missingOperators), { reason: "operator_not_imported", operators: scope.missingOperators });
  }
  const [facts, rawChunks, areas] = await Promise.all([
    loadFacts(input.tenantId, scope),
    loadChunks(input.tenantId, input.question, scope.carrierIds),
    loadCatalogAreas(input.tenantId),
  ]);
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

  const people = scope.ages.length ? `\nIdades das pessoas: ${scope.ages.join(", ")} anos.` : "";
  const result = await runGateway({
    profile: "chat-smart",
    purpose: "cotacao_express",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    temperature: 0,
    maxTokens: 2_500,
    timeoutMs: 60_000,
    schema: z.object({
      found: z.boolean().catch(false),
      answer: z.string().trim().max(6000).catch(""),
      missing: z.string().trim().max(500).optional().catch(undefined),
    }),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pergunta: ${input.question}${people}\n\n${context}` },
    ],
  });
  if (!result.ok) {
    return { status: "error", message: result.reason === "rate_limited" ? "Muitas consultas seguidas. Tente de novo em um minuto." : "Não foi possível consultar a IA agora. Tente novamente em instantes." };
  }
  if (!result.value.found || !result.value.answer) {
    const missing = result.value.missing ? ` Faltou no material: ${result.value.missing}.` : "";
    return blocked(`${NOT_FOUND_MESSAGE}${missing}`, { reason: "model_not_found" });
  }
  const validIds = new Set([...factLines.map((_, index) => `F${index + 1}`), ...chunkLines.map((_, index) => `T${index + 1}`)]);
  const verdict = validateGroundedAnswer({ answer: result.value.answer, validIds, context, question: input.question });
  if (!verdict.ok) {
    return blocked(
      "Não consegui confirmar essa resposta no material importado, então não vou responder para não passar informação errada. Confira o material em Ferramentas › Materiais das operadoras ou pergunte de outro jeito.",
      { reason: verdict.reason, detail: verdict.detail, model: result.model.model },
    );
  }
  const partial = result.value.missing ? `\n\nNão está no material importado: ${result.value.missing}.` : "";
  const titles = new Set<string>();
  for (const fact of facts) if (fact.sourceName) titles.add(fact.sourceName);
  for (const chunk of chunks) titles.add(chunk.title);
  return { status: "answered", answer: `${result.value.answer}${partial}`, sources: [...titles].slice(0, 12).map((title) => ({ title })) };
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
  const question = input.question.trim().slice(0, 500);
  if (question.length < 3) return null;
  const carriers = await getDatabase().select({ name: schema.tenantPrivateCarriers.name })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, input.tenantId), isNull(schema.tenantPrivateCarriers.archivedAt)));
  if (!isOperatorKnowledgeQuestion(question, carriers.map((carrier) => carrier.name))) return null;
  // Outside the pilot the assistant still never answers about operators from its own memory.
  if (input.ragEnabled === false) return "A consulta de operadoras, planos e preços aqui no assistente ainda está em teste. Por enquanto, use a Cotação Express ou fale com a sua gestão.";
  const result = await answerOperatorQuestion({ ...input, question }).catch((): OperatorAnswer => ({ status: "error", message: "Não foi possível consultar o material das operadoras agora. Tente novamente em instantes." }));
  if (result.status !== "answered") return result.message;
  return `${result.answer}\n\nFontes: ${result.sources.map((source) => source.title).join(", ")}`;
}
