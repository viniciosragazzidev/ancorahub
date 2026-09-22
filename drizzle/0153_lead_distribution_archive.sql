ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "archived_by" text;

DO $$
BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_archived_by_user_id_fk"
    FOREIGN KEY ("archived_by") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "leads_tenant_archived_idx"
  ON "leads" ("tenant_id", "archived_at");
