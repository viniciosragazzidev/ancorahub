ALTER TABLE "lead_documents"
  ADD COLUMN IF NOT EXISTS "client_id" text REFERENCES "clients"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "storage_key" text,
  ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'outros',
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "mime_type" text,
  ADD COLUMN IF NOT EXISTS "size_bytes" integer,
  ADD COLUMN IF NOT EXISTS "checksum_sha256" text,
  ADD COLUMN IF NOT EXISTS "scan_status" text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "previous_document_id" text,
  ADD COLUMN IF NOT EXISTS "review_comment" text,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "deleted_by" text REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "lead_documents_tenant_client_idx" ON "lead_documents" ("tenant_id", "client_id");
CREATE INDEX IF NOT EXISTS "lead_documents_tenant_beneficiary_idx" ON "lead_documents" ("tenant_id", "beneficiary_id");
CREATE INDEX IF NOT EXISTS "lead_documents_checksum_idx" ON "lead_documents" ("tenant_id", "checksum_sha256");
