ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "accepting_leads" boolean DEFAULT true NOT NULL;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "auto_distribute" boolean DEFAULT true NOT NULL;
