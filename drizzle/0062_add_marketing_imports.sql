-- Marketing Lead Import engine
-- Tracks spreadsheet imports from the Marketing team
-- No direct Meta API integration - only structured spreadsheet ingestion

CREATE TABLE IF NOT EXISTS "marketing_imports" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "file_name" text NOT NULL,
  "file_hash" text NOT NULL,
  "file_size" integer NOT NULL DEFAULT 0,
  "import_type" text NOT NULL DEFAULT 'pf',
  "status" text NOT NULL DEFAULT 'uploading',
  "total_rows" integer NOT NULL DEFAULT 0,
  "imported_count" integer NOT NULL DEFAULT 0,
  "duplicate_count" integer NOT NULL DEFAULT 0,
  "invalid_count" integer NOT NULL DEFAULT 0,
  "duration_ms" integer,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "marketing_imports_tenant_idx" ON "marketing_imports" USING btree ("tenant_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_imports_tenant_hash_unique" ON "marketing_imports" USING btree ("tenant_id", "file_hash");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "marketing_import_results" (
  "id" text PRIMARY KEY NOT NULL,
  "import_id" text NOT NULL REFERENCES "marketing_imports"("id") ON DELETE CASCADE,
  "lead_id" text REFERENCES "leads"("id") ON DELETE SET NULL,
  "row_index" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'created',
  "message" text,
  "external_lead_id" text,
  "nome" text NOT NULL,
  "telefone" text NOT NULL,
  "email" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "marketing_import_results_import_idx" ON "marketing_import_results" USING btree ("import_id");
--> statement-breakpoint

-- Add captured_at to leads for spreadsheet capture date
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "captured_at" timestamp with time zone;
--> statement-breakpoint

-- Indexes for dedup queries
CREATE INDEX IF NOT EXISTS "leads_tenant_phone_idx" ON "leads" USING btree ("tenant_id", "telefone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_email_idx" ON "leads" USING btree ("tenant_id", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_captured_idx" ON "leads" USING btree ("tenant_id", "captured_at");
