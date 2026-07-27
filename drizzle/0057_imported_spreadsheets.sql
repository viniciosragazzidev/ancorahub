CREATE TABLE IF NOT EXISTS "imported_spreadsheets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "name" text NOT NULL,
  "description" text,
  "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "data" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "row_count" integer NOT NULL DEFAULT 0,
  "public_token" text UNIQUE,
  "public_password_hash" text,
  "public_created_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "imported_spreadsheets_tenant_idx" ON "imported_spreadsheets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "imported_spreadsheets_created_by_idx" ON "imported_spreadsheets" ("created_by");
CREATE UNIQUE INDEX IF NOT EXISTS "imported_spreadsheets_public_token_unique" ON "imported_spreadsheets" ("public_token") WHERE "public_token" IS NOT NULL;
