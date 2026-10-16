import "server-only";

import { and, eq, gte, desc, isNull, lte, or, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { extractSearchKeywords, stripAccents } from "./search-terms";
import { isUndefinedFunctionError } from "@/shared/db/postgres-errors";
import { buildTermSearch } from "./term-search-sql";

export type HybridSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  authorityLevel: number;
  text: string;
  score: number;
  validUntil: Date | null;
};

/**
 * Hybrid RAG Retrieval:
 * Combines Full-Text Search + Metadata Filtering (Tenant Isolation, Authority Level >= minAuthority, Validity)
 */
export async function executeHybridKnowledgeSearch(params: {
  tenantId: string;
  query: string;
  /** Obtained server-side from the configured embedding provider. Never accept this from the browser. */
  queryEmbedding?: number[];
  category?: string;
  minAuthorityLevel?: number;
  limit?: number;
}): Promise<HybridSearchResult[]> {
  const db = getDatabase();
  const maxLimit = params.limit || 5;
  const minAuthority = params.minAuthorityLevel || 1;
  const queryEmbedding = params.queryEmbedding;
  if (queryEmbedding && (!queryEmbedding.length || queryEmbedding.some((value) => !Number.isFinite(value)))) {
    throw new Error("Invalid knowledge-search embedding.");
  }
  const vectorLiteral = queryEmbedding ? `[${queryEmbedding.join(",")}]` : null;
  const semanticDistance = vectorLiteral
    ? sql<number>`(${schema.knowledgeChunks.embedding} <=> ${vectorLiteral}::vector)`
    : null;

  const now = new Date();
  const keywords = extractSearchKeywords(params.query);
  // Without an embedding the database has to pick the candidates by term. Ordering by recency
  // alone cut the answer out whenever newer, unrelated material existed.

  // Query chunks with tenant isolation, authority level, validity and term filters
  const search = (mode: "function" | "inline") => {
    const termSearch = queryEmbedding ? null : buildTermSearch(schema.knowledgeChunks.text, keywords, mode);
    return db
    .select({
      chunkId: schema.knowledgeChunks.id,
      documentId: schema.knowledgeChunks.documentId,
      text: schema.knowledgeChunks.text,
      authorityLevel: schema.knowledgeChunks.authorityLevel,
      title: schema.knowledgeDocuments.title,
      category: schema.knowledgeDocuments.category,
      validUntil: schema.knowledgeDocuments.validUntil,
      semanticDistance: semanticDistance ?? sql<number>`null`,
    })
    .from(schema.knowledgeChunks)
    .innerJoin(
      schema.knowledgeDocuments,
      eq(schema.knowledgeChunks.documentId, schema.knowledgeDocuments.id)
    )
    .where(
      and(
        eq(schema.knowledgeChunks.tenantId, params.tenantId),
        gte(schema.knowledgeChunks.authorityLevel, minAuthority),
        eq(schema.knowledgeDocuments.status, "published"),
        or(isNull(schema.knowledgeDocuments.validFrom), lte(schema.knowledgeDocuments.validFrom, now)),
        or(isNull(schema.knowledgeDocuments.validUntil), gte(schema.knowledgeDocuments.validUntil, now)),
        ...(termSearch ? [termSearch.anyMatch] : []),
        ...(params.category ? [eq(schema.knowledgeDocuments.category, params.category)] : [])
      )
    )
    .orderBy(
      ...(termSearch ? [desc(termSearch.hits)] : []),
      semanticDistance ?? desc(schema.knowledgeChunks.authorityLevel),
      desc(schema.knowledgeChunks.createdAt),
    )
    .limit(maxLimit * 5);
  };

  let chunks: Awaited<ReturnType<typeof search>>;
  try {
    chunks = await search("function");
  } catch (error) {
    // Migration 0205 (ancora_fold and its index) is applied by hand and may be missing: the
    // same search works without it, only slower.
    if (!isUndefinedFunctionError(error)) throw error;
    chunks = await search("inline");
  }

  // Keyword relevance scoring heuristic, accent-insensitive like the SQL filter
  const scored = chunks.map((c) => {
    const textPlain = stripAccents(c.text.toLowerCase());
    let hits = 0;
    for (const kw of keywords) {
      if (textPlain.includes(kw)) hits++;
    }
    // Final score = keyword hits + authority weight
    const semanticScore = typeof c.semanticDistance === "number" ? Math.max(0, 1 - c.semanticDistance) * 20 : 0;
    const score = hits * 10 + c.authorityLevel * 2 + semanticScore;
    return {
      chunkId: c.chunkId,
      documentId: c.documentId,
      title: c.title,
      category: c.category,
      authorityLevel: c.authorityLevel,
      text: c.text,
      score,
      validUntil: c.validUntil,
    };
  });

  // Sort by score descending and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLimit);
}
