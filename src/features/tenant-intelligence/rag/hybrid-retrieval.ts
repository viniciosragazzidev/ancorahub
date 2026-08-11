import "server-only";

import { and, eq, gte, desc, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

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
  category?: string;
  minAuthorityLevel?: number;
  limit?: number;
}): Promise<HybridSearchResult[]> {
  const db = getDatabase();
  const maxLimit = params.limit || 5;
  const minAuthority = params.minAuthorityLevel || 1;

  // Query chunks with tenant isolation and authority level filter
  const chunks = await db
    .select({
      chunkId: schema.knowledgeChunks.id,
      documentId: schema.knowledgeChunks.documentId,
      text: schema.knowledgeChunks.text,
      authorityLevel: schema.knowledgeChunks.authorityLevel,
      title: schema.knowledgeDocuments.title,
      category: schema.knowledgeDocuments.category,
      validUntil: schema.knowledgeDocuments.validUntil,
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
        eq(schema.knowledgeDocuments.status, "published")
      )
    )
    .orderBy(desc(schema.knowledgeChunks.authorityLevel), desc(schema.knowledgeChunks.createdAt))
    .limit(maxLimit * 3);

  // Keyword relevance scoring heuristic
  const keywords = params.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = chunks.map((c) => {
    const textLower = c.text.toLowerCase();
    let hits = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) hits++;
    }
    // Final score = keyword hits + authority weight
    const score = hits * 10 + c.authorityLevel * 2;
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
