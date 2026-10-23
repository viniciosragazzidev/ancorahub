/**
 * Reciprocal rank fusion (Fase 1, 23/10): the term search and the meaning search, for the
 * question and its rewrites, each give a ranking whose scores are not comparable. A chunk
 * scores 1/(k + position) in every ranking it appears in; the sums decide the order. A
 * chunk found by several searches rises, one found high by a single search still counts.
 * Pure: tested in rank-fusion.test.ts.
 */

const RRF_K = 60;

type Rankable = { chunkId: string; keywordHits: number; semanticDistance: number | null; score: number };

export function fuseRankings<T extends Rankable>(rankings: T[][], limit: number): T[] {
  const fused = new Map<string, { chunk: T; score: number }>();
  for (const ranking of rankings) {
    ranking.forEach((chunk, position) => {
      const known = fused.get(chunk.chunkId);
      const gain = 1 / (RRF_K + position + 1);
      if (!known) {
        fused.set(chunk.chunkId, { chunk: { ...chunk }, score: gain });
        return;
      }
      known.score += gain;
      // The relevance guard reads the best evidence of any search.
      known.chunk.keywordHits = Math.max(known.chunk.keywordHits, chunk.keywordHits);
      if (chunk.semanticDistance !== null) {
        known.chunk.semanticDistance = known.chunk.semanticDistance === null ? chunk.semanticDistance : Math.min(known.chunk.semanticDistance, chunk.semanticDistance);
      }
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}

/** The order the reranker chose (1-based excerpt numbers); excerpts it skipped are dropped, unknown numbers ignored. */
export function applyRerank<T>(candidates: T[], order: number[], limit: number): T[] {
  const seen = new Set<number>();
  const picked: T[] = [];
  for (const number of order) {
    const index = number - 1;
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length || seen.has(index)) continue;
    seen.add(index);
    picked.push(candidates[index]!);
    if (picked.length >= limit) break;
  }
  return picked;
}
