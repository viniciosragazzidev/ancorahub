ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "max_active_leads_limit" integer NOT NULL DEFAULT 10;
