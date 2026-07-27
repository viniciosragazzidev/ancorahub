-- Reconcile quote columns used by the current quote builder with older databases.
-- Every operation is idempotent so it is safe on partially migrated environments.
ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "lead_name" text,
  ADD COLUMN IF NOT EXISTS "lead_phone" text,
  ADD COLUMN IF NOT EXISTS "total_monthly" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "beneficiary_count" integer;
