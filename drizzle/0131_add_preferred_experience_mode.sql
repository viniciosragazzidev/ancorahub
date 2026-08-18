ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "preferred_experience_mode" text DEFAULT 'LIGHT' NOT NULL;
