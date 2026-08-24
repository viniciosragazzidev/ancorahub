ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "is_distribution_hub" boolean NOT NULL DEFAULT false;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "branches_one_distribution_hub_per_tenant"
  ON "branches" ("tenant_id")
  WHERE "is_distribution_hub" = true;
