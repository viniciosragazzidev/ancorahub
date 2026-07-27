ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "initial_setup_completed_at" timestamptz;
