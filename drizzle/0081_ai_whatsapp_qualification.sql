CREATE TABLE IF NOT EXISTS "ai_qualification_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "assistant_name" text NOT NULL DEFAULT 'Assistente CorreTop',
  "initial_message" text NOT NULL,
  "timeout_minutes" integer NOT NULL DEFAULT 30,
  "max_retries" integer NOT NULL DEFAULT 2,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ai_qualification_configs_tenant_unique" UNIQUE ("tenant_id")
);

CREATE TABLE IF NOT EXISTS "ai_qualification_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'waiting_customer',
  "current_question_key" text NOT NULL DEFAULT 'city',
  "collected_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "missing_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "score" integer,
  "summary" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "last_interaction_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "failure_reason" text,
  "version" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ai_qualification_sessions_tenant_lead_unique" UNIQUE ("tenant_id", "lead_id")
);

CREATE INDEX IF NOT EXISTS "ai_qualification_sessions_tenant_status_idx" ON "ai_qualification_sessions" ("tenant_id", "status");

INSERT INTO "system_settings" ("key", "value") VALUES ('feature_ai_whatsapp_qualification_enabled', 'true') ON CONFLICT ("key") DO NOTHING;
