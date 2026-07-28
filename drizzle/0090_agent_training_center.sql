INSERT INTO "system_settings" ("key", "value") VALUES
  ('feature_agent_training_center_enabled', 'false')
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "agent_behavior_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "policy" jsonb NOT NULL,
  "validation" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "summary" text,
  "published_at" timestamptz,
  "published_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "version_number")
);
CREATE INDEX IF NOT EXISTS "agent_behavior_versions_tenant_status_idx" ON "agent_behavior_versions" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "agent_training_simulations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "behavior_version_id" text NOT NULL REFERENCES "agent_behavior_versions"("id") ON DELETE CASCADE,
  "scenario_key" text NOT NULL,
  "status" text NOT NULL,
  "result" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "review" text,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_training_simulations_version_idx" ON "agent_training_simulations" ("tenant_id", "behavior_version_id", "scenario_key");

ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "behavior_version_id" text REFERENCES "agent_behavior_versions"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ai_conversations_behavior_version_idx" ON "ai_conversations" ("tenant_id", "behavior_version_id");
