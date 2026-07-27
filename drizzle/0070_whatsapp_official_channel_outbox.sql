-- Official company channel hardening and delivery outbox.
-- Branch-specific channels remain schema-compatible for a future phase, but
-- the current product only creates one active company channel per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "communication_channels_active_company_default_unique"
  ON "communication_channels" ("tenant_id")
  WHERE "provider" = 'meta_cloud'
    AND "branch_id" IS NULL
    AND "is_default" = true
    AND "status" = 'active';

CREATE TABLE IF NOT EXISTS "whatsapp_outbound_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "channel_id" text NOT NULL REFERENCES "communication_channels"("id") ON DELETE RESTRICT,
  "recipient_type" text NOT NULL,
  "recipient_id" text,
  "destination_phone" text NOT NULL,
  "purpose" text NOT NULL,
  "template_name" text NOT NULL,
  "template_language" text NOT NULL DEFAULT 'pt_BR',
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "provider_message_id" text,
  "provider_error_code" text,
  "provider_error_message" text,
  "idempotency_key" text NOT NULL,
  "scheduled_at" timestamptz,
  "queued_at" timestamptz,
  "sent_at" timestamptz,
  "delivered_at" timestamptz,
  "read_at" timestamptz,
  "failed_at" timestamptz,
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz,
  "requested_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_outbound_messages_tenant_idempotency_unique"
  ON "whatsapp_outbound_messages" ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_queue_idx"
  ON "whatsapp_outbound_messages" ("status", "next_attempt_at", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_tenant_idx"
  ON "whatsapp_outbound_messages" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_provider_idx"
  ON "whatsapp_outbound_messages" ("provider_message_id");
