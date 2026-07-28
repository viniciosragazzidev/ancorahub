INSERT INTO "system_settings" ("key", "value") VALUES
  ('feature_qualification_engine_enabled', 'false'),
  ('feature_distribution_by_qualification_enabled', 'false'),
  ('feature_broker_ranking_enabled', 'false')
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualification_state" text NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualification_score" integer NOT NULL DEFAULT 0;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualification_details" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualification_profile_key" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "qualification_completed_at" timestamptz;
CREATE INDEX IF NOT EXISTS "leads_tenant_qualification_state_idx" ON "leads" ("tenant_id", "qualification_state");

CREATE TABLE IF NOT EXISTS "lead_distribution_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "queue_id" text REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "profile_key" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "version" integer NOT NULL DEFAULT 1,
  "policy" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_distribution_policies_tenant_idx" ON "lead_distribution_policies" ("tenant_id", "queue_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lead_distribution_policies_scope_unique" ON "lead_distribution_policies" ("tenant_id", "queue_id", "profile_key");
