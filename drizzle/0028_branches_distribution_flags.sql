ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "accepting_leads" boolean NOT NULL DEFAULT true;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "auto_distribute" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_distribution_idx" ON "branches" ("tenant_id", "accepting_leads", "status");
