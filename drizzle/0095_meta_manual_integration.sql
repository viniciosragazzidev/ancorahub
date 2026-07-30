CREATE TABLE IF NOT EXISTS "meta_integration_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "communication_channel_id" text REFERENCES "communication_channels"("id") ON DELETE SET NULL,
  "facebook_page_id" text,
  "ad_account_id" text,
  "pixel_id" text,
  "dataset_id" text,
  "tutorial_completed_at" timestamp with time zone,
  "last_synced_at" timestamp with time zone,
  "last_error" text,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_integration_settings_tenant_unique" ON "meta_integration_settings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "meta_integration_settings_channel_idx" ON "meta_integration_settings" ("communication_channel_id");
