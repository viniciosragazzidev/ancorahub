ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_origin" text;

CREATE INDEX IF NOT EXISTS "leads_tenant_distribution_origin_idx"
  ON "leads" USING btree ("tenant_id", "distribution_origin");
