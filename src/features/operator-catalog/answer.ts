import "server-only";

import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { executeHybridKnowledgeSearch, type HybridSearchResult } from "@/features/tenant-intelligence/rag/hybrid-retrieval";
import { getDatabase, schema } from "@/shared/db";

import { embedQuery } from "./embeddings";
import { toNamedEntity } from "./matching";
import { ageBandsInQuestion, carriersInQuestion, plansInQuestion } from "./question-scope";
import { loadCatalogAreas } from "./service";

const MAX_FACTS = 120;
const MAX_CHUNKS = 6;

const SYSTEM_PROMPT = [
  "Você é o assistente de cotação de planos de saúde da corretora.",
  "Responda em português, curto e direto, somente com base nas informações catalogadas [F] e nos trechos de material [T] fornecidos.",
  "Prefira as informações catalogadas [F]: são os dados conferidos do catálogo. Use os trechos [T] para completar.",
  "Cite a origem de cada valor, regra ou prazo entre colchetes, por exemplo [F3] ou [T1].",
  "Nunca invente preço, faixa etária, operadora, plano, carência ou rede. Se a informação pedida não estiver aqui, diga que ainda não há dado catalogado para isso.",
  "Diga a vigência junto do valor quando ela for informada.",
  "Trechos marcados como leitura automática de imagem podem ter erros: avise para confirmar no material original.",
  'Devolva somente um JSON: {"answer": "sua resposta"}.',
].join(" ");

export type OperatorAnswer =
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
  return { carrierIds, planIds: plans.map((plan) => plan.id), bands: ageBandsInQuestion(question) };
}

async function loadFacts(tenantId: string, scope: { carrierIds: string[]; planIds: string[]; bands: string[] }) {
  if (!scope.carrierIds.length) return [];
  const now = new Date();
  // Prices only for the ages asked: a full table would crowd out the rules.
  const priceFilter = scope.bands.length
    ? or(sql`${schema.operatorCatalogFacts.areaSlug} <> 'precos'`, inArray(sql`${schema.operatorCatalogFacts.qualifiers}->>'faixa_etaria'`, scope.bands))
    : sql`${schema.operatorCatalogFacts.areaSlug} <> 'precos'`;
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
    })
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .leftJoin(schema.knowledgeSources, eq(schema.knowledgeSources.id, schema.operatorCatalogFacts.sourceId))
    .where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      eq(schema.operatorCatalogFacts.status, "current"),
      eq(schema.operatorCatalogFacts.origin, "material"),
      inArray(schema.operatorCatalogFacts.carrierId, scope.carrierIds),
      // A plan still waiting for the director is not offered to brokers.
      or(isNull(schema.operatorCatalogFacts.planId), eq(schema.tenantPrivatePlans.active, true)),
      or(sql`${schema.operatorCatalogFacts.validUntil} is null`, sql`${schema.operatorCatalogFacts.validUntil} >= ${now.toISOString()}::timestamptz`),
      scope.planIds.length ? or(inArray(schema.operatorCatalogFacts.planId, scope.planIds), isNull(schema.operatorCatalogFacts.planId)) : undefined,
      priceFilter,
    ))
    .orderBy(asc(schema.tenantPrivatePlans.name), asc(schema.operatorCatalogFacts.areaSlug))
    .limit(MAX_FACTS);
}

/** Term search and meaning search, merged: a chunk found by both keeps the better score. */
async function loadChunks(tenantId: string, question: string, carrierIds: string[]) {
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
  return ranked;
}

/**
 * Answers a broker's question about operators from the catalog: the operator
 * and plans named in the question narrow both the catalogued facts and the
 * material excerpts, and the model answers only from them, citing each one.
 */
export async function answerOperatorQuestion(input: { tenantId: string; userId: string; question: string }): Promise<OperatorAnswer> {
  const scope = await loadScope(input.tenantId, input.question);
  const [facts, chunks, areas] = await Promise.all([
    loadFacts(input.tenantId, scope),
    loadChunks(input.tenantId, input.question, scope.carrierIds),
    loadCatalogAreas(input.tenantId),
  ]);
  if (!facts.length && !chunks.length) {
    return { status: "no_material", message: "Ainda não há material catalogado sobre isso. Quando as tabelas e manuais forem importados em Ferramentas, a resposta passa a usar esses dados." };
  }

  const label = (areaSlug: string, fieldKey: string) => {
    const area = areas.find((item) => item.slug === areaSlug);
    return `${area?.label ?? areaSlug} / ${area?.fields.find((field) => field.key === fieldKey)?.label ?? fieldKey}`;
  };
  const factLines = facts.map((fact, index) => {
    const qualifiers = Object.entries((fact.qualifiers ?? {}) as Record<string, string>).map(([key, value]) => `${key}: ${value}`).join(", ");
    const until = formatDate(fact.validUntil);
    return `[F${index + 1}] ${fact.carrierName}${fact.planName ? ` · ${fact.planName}` : ""} · ${label(fact.areaSlug, fact.fieldKey)}${qualifiers ? ` (${qualifiers})` : ""} = ${fact.valueText}${until ? ` · válido até ${until}` : ""}${fact.sourceName ? ` · fonte: ${fact.sourceName}` : ""}`;
  });
  const chunkLines = chunks.map((chunk, index) => {
    const until = formatDate(chunk.validUntil);
    return `[T${index + 1}] ${chunk.title}${until ? ` (válido até ${until})` : ""}\n${chunk.text}`;
  });

  const result = await runGateway({
    profile: "chat-smart",
    purpose: "cotacao_express",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    temperature: 0.1,
    maxTokens: 1_500,
    timeoutMs: 45_000,
    schema: z.object({ answer: z.string().trim().min(1).max(6000) }),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pergunta: ${input.question}\n\nInformações catalogadas:\n${factLines.join("\n") || "(nenhuma)"}\n\nTrechos de material:\n${chunkLines.join("\n\n") || "(nenhum)"}` },
    ],
  });
  if (!result.ok) {
    return { status: "error", message: result.reason === "rate_limited" ? "Muitas consultas seguidas. Tente de novo em um minuto." : "Não foi possível consultar a IA agora. Tente novamente em instantes." };
  }
  const titles = new Set<string>();
  for (const fact of facts) if (fact.sourceName) titles.add(fact.sourceName);
  for (const chunk of chunks) titles.add(chunk.title);
  return { status: "answered", answer: result.value.answer, sources: [...titles].slice(0, 12).map((title) => ({ title })) };
}
