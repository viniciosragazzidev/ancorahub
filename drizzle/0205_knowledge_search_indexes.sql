-- Search over operator material (groups' PDFs and images).
--
-- 1. ancora_fold(text): lowercase with accents removed. The retrieval searches
--    `ancora_fold(text) like '%term%'`, so "cotação" and "cotacao" are the same
--    term. The two literals below are the same ones as SQL_ACCENT_FROM and
--    SQL_ACCENT_TO in search-terms.ts; a test keeps them in step.
-- 2. A trigram index on that expression, so the substring search does not scan
--    every chunk of the tenant. Terms have at least 3 characters, which is what
--    pg_trgm needs to use the index.
-- 3. One file, one source per tenant: two copies of the same PDF or image that
--    arrive together cannot both be published. Limited to operator material,
--    which does not exist yet, so no existing row can break the index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ancora_fold(value text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(translate(value, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')) $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_chunks_text_fold_trgm_idx" ON "knowledge_chunks" USING gin (ancora_fold("text") gin_trgm_ops);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_sources_operator_hash_unique" ON "knowledge_sources" ("tenant_id", "hash_md5") WHERE "category" = 'operator_material' AND "hash_md5" IS NOT NULL;
