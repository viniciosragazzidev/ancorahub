-- pgvector is optional at runtime but the schema is prepared in Supabase.
-- No index is created before the Super-admin selects the embedding model and
-- its dimension; a mismatched vector index would be unsafe and unusable.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_chunks"
  ADD COLUMN IF NOT EXISTS "embedding" vector;
