ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "hold_disqualified_leads" boolean NOT NULL DEFAULT false;--> statement-breakpoint

UPDATE "tenants"
SET "hold_disqualified_leads" = false
WHERE "hold_disqualified_leads" IS NULL;
