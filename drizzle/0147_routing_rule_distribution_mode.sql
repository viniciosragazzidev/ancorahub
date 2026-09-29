ALTER TABLE "lead_routing_rules"
  ADD COLUMN IF NOT EXISTS "distribution_mode" text NOT NULL DEFAULT 'automatic';--> statement-breakpoint

UPDATE "lead_routing_rules"
SET "distribution_mode" = 'automatic'
WHERE "distribution_mode" IS NULL;
