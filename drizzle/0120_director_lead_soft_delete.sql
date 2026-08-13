ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deleted_by" text REFERENCES "user"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "leads_tenant_deleted_idx" ON "leads" ("tenant_id", "deleted_at");
