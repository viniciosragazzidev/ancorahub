-- The materials number (the WhatsApp that only reads operator groups) is a
-- waha_numbers row with its own scope, "tenant_materials", so it is never found
-- in place of the director channel (which is looked up by scope "tenant").
-- Migration 0103 limits scope to platform, tenant and branch, so inserting the
-- new scope fails with a check violation (23514). Same rules, one more scope:
-- tied to a tenant, never to a branch. One statement, so the table is never
-- without the constraint.
ALTER TABLE "waha_numbers"
  DROP CONSTRAINT IF EXISTS "waha_numbers_scope_check",
  ADD CONSTRAINT "waha_numbers_scope_check"
  CHECK (
    ("scope" = 'platform' AND "tenant_id" IS NULL AND "branch_id" IS NULL)
    OR ("scope" = 'tenant' AND "tenant_id" IS NOT NULL AND "branch_id" IS NULL)
    OR ("scope" = 'branch' AND "tenant_id" IS NOT NULL AND "branch_id" IS NOT NULL)
    OR ("scope" = 'tenant_materials' AND "tenant_id" IS NOT NULL AND "branch_id" IS NULL)
  );
