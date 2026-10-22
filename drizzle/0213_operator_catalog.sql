-- Catálogo de material das operadoras (plano docs/implementations/active/2026-10-22-catalogo-operadoras.md).
-- Cada arquivo importado (upload do diretor ou grupo de WhatsApp) é lido, classificado por
-- operadora, plano e área, e vira fatos estruturados. Material novo é comparado fato a fato:
-- só o que mudou é atualizado, preço novo ou alterado espera revisão do diretor.
-- Só tabelas e colunas novas; nada existente muda de tipo.

-- Estado da catalogação de cada arquivo (knowledge_sources já guarda o arquivo e o hash).
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "extracted_text" text;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "catalog_status" text;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "catalog_summary" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "catalog_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "document_type" text;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "carrier_id" text REFERENCES "tenant_private_carriers"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "knowledge_sources_catalog_idx" ON "knowledge_sources" ("tenant_id", "catalog_status") WHERE "category" = 'operator_material';

-- Versões do mesmo material (mesma operadora, tipo e assunto): a nova substitui a antiga.
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "document_key" text;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "superseded_by" text;
CREATE INDEX IF NOT EXISTS "knowledge_documents_key_idx" ON "knowledge_documents" ("tenant_id", "document_key", "status") WHERE "document_key" IS NOT NULL;

-- Trecho igual entre versões reaproveita o embedding em vez de calcular de novo.
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "content_hash" text;
CREATE INDEX IF NOT EXISTS "knowledge_chunks_content_hash_idx" ON "knowledge_chunks" ("tenant_id", "content_hash") WHERE "content_hash" IS NOT NULL;

-- Áreas e campos criados além dos padrões do sistema (os padrões ficam no código).
CREATE TABLE IF NOT EXISTS "operator_catalog_areas" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "operator_catalog_areas_tenant_slug_unique" ON "operator_catalog_areas" ("tenant_id", "slug");

-- Sugestões da IA: área nova ou campo novo numa área. Só viram catálogo depois de aprovadas.
CREATE TABLE IF NOT EXISTS "operator_catalog_suggestions" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "area_slug" text NOT NULL,
  "field_key" text NOT NULL DEFAULT '',
  "label" text NOT NULL,
  "description" text,
  "example" text,
  "occurrences" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'pending',
  "source_id" text REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "reviewed_by" text REFERENCES "user"("id"),
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "operator_catalog_suggestions_unique" ON "operator_catalog_suggestions" ("tenant_id", "kind", "area_slug", "field_key");

-- Cada informação catalogada: operadora + plano + área + campo + valor, com vigência e fonte.
CREATE TABLE IF NOT EXISTS "operator_catalog_facts" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "carrier_id" text NOT NULL REFERENCES "tenant_private_carriers"("id") ON DELETE CASCADE,
  "plan_id" text REFERENCES "tenant_private_plans"("id") ON DELETE SET NULL,
  "area_slug" text NOT NULL,
  "field_key" text NOT NULL,
  "value_text" text NOT NULL,
  "value_number" numeric(14, 2),
  "unit" text,
  "qualifiers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "fact_key" text NOT NULL,
  "origin" text NOT NULL DEFAULT 'material',
  "status" text NOT NULL,
  "replaces_fact_id" text,
  "diverges_from_fact_id" text,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "source_id" text REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "document_id" text REFERENCES "knowledge_documents"("id") ON DELETE SET NULL,
  "page" integer,
  "excerpt" text,
  "confidence" real,
  "reviewed_by" text REFERENCES "user"("id"),
  "reviewed_at" timestamptz,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "operator_catalog_facts_key_idx" ON "operator_catalog_facts" ("tenant_id", "fact_key", "status");
CREATE INDEX IF NOT EXISTS "operator_catalog_facts_browse_idx" ON "operator_catalog_facts" ("tenant_id", "carrier_id", "area_slug", "status");
CREATE INDEX IF NOT EXISTS "operator_catalog_facts_status_idx" ON "operator_catalog_facts" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "operator_catalog_facts_source_idx" ON "operator_catalog_facts" ("source_id");
