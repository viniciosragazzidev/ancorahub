ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "accepting_leads" boolean NOT NULL DEFAULT true;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "auto_distribute" boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "branches_distribution_idx" ON "branches" ("tenant_id", "accepting_leads", "status");

ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "job_title" text NOT NULL DEFAULT 'broker';

CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
