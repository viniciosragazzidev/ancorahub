ALTER TABLE "tenant_memberships"
  ADD COLUMN IF NOT EXISTS "supervisor_id" text REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tenant_memberships_supervisor_id_idx"
  ON "tenant_memberships" ("supervisor_id");
