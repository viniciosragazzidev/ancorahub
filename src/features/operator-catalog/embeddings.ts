import "server-only";

import { providerKey } from "@/features/ai-gateway/gateway";

/**
 * Meaning search for the operator material (decision of 2026-10-22): OpenAI
 * text-embedding-3-small, 1536 dimensions, a few cents per thousands of pages.
 * Without an OpenAI key the catalog still works on the term search alone.
 */
export const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
const BATCH_SIZE = 64;
/** The model reads up to ~8k tokens; a chunk is ~1.2k characters, so this only guards odd inputs. */
const MAX_INPUT_CHARS = 8_000;

export async function embeddingsAvailable() {
  return Boolean(await providerKey("openai"));
}

/** One vector per text, in order; null when there is no key or the call fails (the caller keeps going). */
export async function embedTexts(texts: string[]): Promise<Array<number[] | null>> {
  const key = await providerKey("openai");
  if (!key || !texts.length) return texts.map(() => null);
  const vectors: Array<number[] | null> = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE).map((text) => text.slice(0, MAX_INPUT_CHARS));
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
      const byIndex = new Map((body.data ?? []).map((item) => [item.index, item.embedding]));
      vectors.push(...batch.map((_, index) => byIndex.get(index) ?? null));
    } catch (error) {
      console.warn("[operator-catalog] embeddings_failed", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
      vectors.push(...batch.map(() => null));
    }
  }
  return vectors;
}

export async function embedQuery(text: string) {
  const [vector] = await embedTexts([text]);
  return vector ?? null;
}
