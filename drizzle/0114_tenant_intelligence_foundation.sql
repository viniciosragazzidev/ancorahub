CREATE TABLE IF NOT EXISTS "tenant_intelligence_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "trade_name" text,
  "company_name" text,
  "cnpj" text,
  "description" text,
  "segment" text DEFAULT 'Planos de Saúde e Odontológicos',
  "website" text,
  "phone" text,
  "email" text,
  "address_street" text,
  "address_number" text,
  "address_complement" text,
  "address_city" text,
  "address_state" text,
  "address_zip" text,
  "positioning" jsonb NOT NULL DEFAULT '{"aboutUs":"","differentials":[],"targetAudience":"","regionsServed":[],"productsOffered":[],"toneOfVoice":"professional"}'::jsonb,
  "service_config" jsonb NOT NULL DEFAULT '{"businessHours":"08:00 às 18:00","businessDays":"Segunda a Sexta","channels":["WhatsApp","Site","Telefone"],"slaMinutes":15,"supportEmail":"","supportPhone":""}'::jsonb,
  "commercial_rules" jsonb NOT NULL DEFAULT '{"operators":[],"products":[],"rulesSummary":""}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "unit_intelligence_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "unit_name" text NOT NULL,
  "manager_name" text,
  "manager_email" text,
  "phone" text,
  "address_street" text,
  "address_city" text,
  "address_state" text,
  "business_hours" text,
  "service_regions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "unit_intel_tenant_branch_unique" UNIQUE ("tenant_id", "branch_id")
);

CREATE TABLE IF NOT EXISTS "knowledge_collections" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "color" text DEFAULT '#3b82f6',
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_coll_tenant_slug_unique" UNIQUE ("tenant_id", "slug")
);

CREATE TABLE IF NOT EXISTS "knowledge_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "file_url" text NOT NULL,
  "hash_md5" text,
  "category" text NOT NULL DEFAULT 'general',
  "status" text NOT NULL DEFAULT 'uploaded',
  "error_message" text,
  "uploaded_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "knowledge_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source_id" text REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "collection_id" text REFERENCES "knowledge_collections"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "canonical_content" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "authority_level" integer NOT NULL DEFAULT 3,
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'published',
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "document_id" text NOT NULL REFERENCES "knowledge_documents"("id") ON DELETE CASCADE,
  "chunk_index" integer NOT NULL,
  "text" text NOT NULL,
  "token_count" integer NOT NULL DEFAULT 0,
  "authority_level" integer NOT NULL DEFAULT 3,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "knowledge_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source_id" text REFERENCES "knowledge_sources"("id") ON DELETE SET NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "title" text NOT NULL,
  "current_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "detected_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "diff" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "knowledge_conflicts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "doc_id_a" text NOT NULL,
  "doc_id_b" text NOT NULL,
  "topic" text NOT NULL,
  "fact_a" text NOT NULL,
  "fact_b" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "resolved_by" text,
  "resolved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agent_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "objective" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "model_provider" text NOT NULL DEFAULT 'groq',
  "model_name" text NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  "temperature" numeric NOT NULL DEFAULT '0.7',
  "max_tokens" integer NOT NULL DEFAULT 1024,
  "system_prompt" text NOT NULL,
  "allowed_tools" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "allowed_collection_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "memory_scope" text NOT NULL DEFAULT 'conversation',
  "output_format" text NOT NULL DEFAULT 'markdown',
  "version" integer NOT NULL DEFAULT 1,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "agent_def_tenant_slug_unique" UNIQUE ("tenant_id", "slug")
);

CREATE TABLE IF NOT EXISTS "evaluation_test_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "agent_id" text REFERENCES "agent_definitions"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "input_prompt" text NOT NULL,
  "expected_output" text NOT NULL,
  "forbidden_output" text,
  "expected_tools" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agent_evaluation_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "agent_id" text NOT NULL REFERENCES "agent_definitions"("id") ON DELETE CASCADE,
  "agent_version" integer NOT NULL,
  "total_cases" integer NOT NULL,
  "passed_cases" integer NOT NULL,
  "accuracy_rate" numeric NOT NULL,
  "hallucination_rate" numeric NOT NULL,
  "avg_latency_ms" integer NOT NULL,
  "total_cost_est" numeric NOT NULL DEFAULT '0.00',
  "run_details" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversation_examples" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "channel" text DEFAULT 'whatsapp',
  "outcome" text NOT NULL DEFAULT 'converted',
  "quality_rating" integer NOT NULL DEFAULT 5,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "anonymized_messages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "extracted_playbook" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_sources_tenant_idx" ON "knowledge_sources" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "knowledge_docs_tenant_status_idx" ON "knowledge_documents" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_tenant_doc_idx" ON "knowledge_chunks" ("tenant_id", "document_id");
CREATE INDEX IF NOT EXISTS "knowledge_sugg_tenant_status_idx" ON "knowledge_suggestions" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "knowledge_conflicts_tenant_idx" ON "knowledge_conflicts" ("tenant_id", "status");
