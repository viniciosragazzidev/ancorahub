ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "redistribution_count" integer DEFAULT 0 NOT NULL;
