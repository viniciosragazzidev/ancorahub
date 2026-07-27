CREATE TABLE IF NOT EXISTS "communication_channels" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "owner_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "channel_type" text NOT NULL DEFAULT 'shared',
  "status" text NOT NULL DEFAULT 'pending',
  "business_id" text,
  "waba_id" text,
  "phone_number_id" text,
  "display_phone_number" text,
  "verified_name" text,
  "quality_rating" text,
  "messaging_limit" text,
  "access_token_ciphertext" text,
  "token_key_version" text,
  "token_expires_at" timestamptz,
  "is_default" boolean NOT NULL DEFAULT false,
  "last_webhook_at" timestamptz,
  "activated_at" timestamptz,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_channels_tenant_status_idx" ON "communication_channels" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_channels_tenant_branch_idx" ON "communication_channels" ("tenant_id", "branch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_channels_provider_phone_unique" ON "communication_channels" ("provider", "phone_number_id") WHERE "phone_number_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_channel_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text REFERENCES "communication_channels"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "external_event_id" text,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'received',
  "error_code" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_channel_webhook_events_channel_idx" ON "communication_channel_webhook_events" ("channel_id", "received_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_channel_webhook_events_provider_external_unique" ON "communication_channel_webhook_events" ("provider", "external_event_id") WHERE "external_event_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "communication_channel_id" text REFERENCES "communication_channels"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'openwa_legacy';
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "provider_status" text;
