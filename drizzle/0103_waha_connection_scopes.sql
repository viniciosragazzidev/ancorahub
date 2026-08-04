ALTER TABLE "waha_numbers"
  ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenants"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "branch_id" text REFERENCES "branches"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS "label" text;
--> statement-breakpoint
ALTER TABLE "waha_numbers"
  ADD CONSTRAINT "waha_numbers_scope_check"
  CHECK (
    ("scope" = 'platform' AND "tenant_id" IS NULL AND "branch_id" IS NULL)
    OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL AND "branch_id" IS NULL)
    OR ("scope" = 'branch' AND "tenant_id" IS NOT NULL AND "branch_id" IS NOT NULL)
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_numbers_tenant_scope_idx"
  ON "waha_numbers" ("tenant_id", "branch_id", "status");
