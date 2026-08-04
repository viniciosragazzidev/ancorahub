CREATE TABLE IF NOT EXISTS "internal_report_documents" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "filename" text NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum_sha256" text NOT NULL,
  "uploaded_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "internal_report_documents_tenant_created_idx" ON "internal_report_documents" ("tenant_id", "created_at");
