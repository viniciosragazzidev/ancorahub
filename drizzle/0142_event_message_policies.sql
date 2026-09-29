CREATE TABLE IF NOT EXISTS "communication_event_message_policies" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "event_key" text NOT NULL,
  "primary_kind" text NOT NULL DEFAULT 'meta_template',
  "meta_template_id" text REFERENCES "meta_whatsapp_templates"("id") ON DELETE set null,
  "free_message_template_id" text REFERENCES "message_templates"("id") ON DELETE set null,
  "meta_variable_mappings_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "fallback_kind" text,
  "active" boolean NOT NULL DEFAULT true,
  "version" integer NOT NULL DEFAULT 1,
  "updated_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communication_event_message_policies_primary_kind_check"
    CHECK ("primary_kind" IN ('meta_template', 'free_message')),
  CONSTRAINT "communication_event_message_policies_fallback_kind_check"
    CHECK ("fallback_kind" IS NULL OR "fallback_kind" IN ('meta_template', 'free_message')),
  CONSTRAINT "communication_event_message_policies_distinct_order_check"
    CHECK ("fallback_kind" IS NULL OR "fallback_kind" <> "primary_kind")
);

CREATE UNIQUE INDEX IF NOT EXISTS "communication_event_message_policies_tenant_event_unique"
  ON "communication_event_message_policies" ("tenant_id", "event_key");
CREATE INDEX IF NOT EXISTS "communication_event_message_policies_tenant_active_idx"
  ON "communication_event_message_policies" ("tenant_id", "active");

INSERT INTO "communication_event_message_policies" (
  "id",
  "tenant_id",
  "event_key",
  "primary_kind",
  "meta_template_id",
  "fallback_kind",
  "active",
  "version",
  "created_at",
  "updated_at"
)
SELECT
  'event-policy-' || "id",
  "tenant_id",
  "event_key",
  'meta_template',
  "template_id",
  NULL,
  "active",
  1,
  "created_at",
  "updated_at"
FROM "meta_whatsapp_template_usages"
ON CONFLICT ("tenant_id", "event_key") DO NOTHING;

ALTER TABLE "whatsapp_outbound_messages"
  ADD COLUMN IF NOT EXISTS "message_policy_id" text,
  ADD COLUMN IF NOT EXISTS "message_policy_version" integer,
  ADD COLUMN IF NOT EXISTS "rendered_body" text,
  ADD COLUMN IF NOT EXISTS "provider_variables" jsonb,
  ADD COLUMN IF NOT EXISTS "template_variable_names" jsonb,
  ADD COLUMN IF NOT EXISTS "fallback_message_type" text,
  ADD COLUMN IF NOT EXISTS "fallback_template_name" text,
  ADD COLUMN IF NOT EXISTS "fallback_template_language" text,
  ADD COLUMN IF NOT EXISTS "fallback_rendered_body" text,
  ADD COLUMN IF NOT EXISTS "fallback_provider_variables" jsonb,
  ADD COLUMN IF NOT EXISTS "fallback_template_variable_names" jsonb;

ALTER TABLE "whatsapp_outbound_messages"
  DROP CONSTRAINT IF EXISTS "whatsapp_outbound_messages_fallback_message_type_check";
ALTER TABLE "whatsapp_outbound_messages"
  ADD CONSTRAINT "whatsapp_outbound_messages_fallback_message_type_check"
  CHECK ("fallback_message_type" IS NULL OR "fallback_message_type" IN ('template', 'text'));

CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_policy_idx"
  ON "whatsapp_outbound_messages" ("tenant_id", "message_policy_id");
