ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meta_campaign_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meta_ad_set_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meta_ad_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meta_form_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "meta_page_id" text;

CREATE TABLE IF NOT EXISTS "meta_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "business_id" text NOT NULL,
  "business_name" text,
  "access_token_ciphertext" text NOT NULL,
  "token_key_version" text NOT NULL DEFAULT 'v1',
  "expires_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'connected',
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "last_error" text,
  "last_synced_at" timestamp with time zone,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_connections_tenant_business_unique" ON "meta_connections" ("tenant_id", "business_id");
CREATE INDEX IF NOT EXISTS "meta_connections_tenant_status_idx" ON "meta_connections" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "meta_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "connection_id" text NOT NULL REFERENCES "meta_connections"("id") ON DELETE CASCADE,
  "page_id" text NOT NULL,
  "name" text NOT NULL,
  "access_token_ciphertext" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_pages_tenant_page_unique" ON "meta_pages" ("tenant_id", "page_id");
CREATE INDEX IF NOT EXISTS "meta_pages_tenant_idx" ON "meta_pages" ("tenant_id");

CREATE TABLE IF NOT EXISTS "meta_ad_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "connection_id" text NOT NULL REFERENCES "meta_connections"("id") ON DELETE CASCADE,
  "ad_account_id" text NOT NULL,
  "name" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'BRL',
  "account_status" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_accounts_tenant_account_unique" ON "meta_ad_accounts" ("tenant_id", "ad_account_id");
CREATE INDEX IF NOT EXISTS "meta_ad_accounts_tenant_idx" ON "meta_ad_accounts" ("tenant_id");

CREATE TABLE IF NOT EXISTS "meta_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ad_account_id" text NOT NULL,
  "campaign_id" text NOT NULL,
  "name" text NOT NULL,
  "objective" text,
  "status" text NOT NULL DEFAULT 'PAUSED',
  "daily_budget" integer,
  "lifetime_budget" integer,
  "start_time" timestamp with time zone,
  "stop_time" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_campaigns_tenant_campaign_unique" ON "meta_campaigns" ("tenant_id", "campaign_id");
CREATE INDEX IF NOT EXISTS "meta_campaigns_tenant_status_idx" ON "meta_campaigns" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "meta_campaigns_ad_account_idx" ON "meta_campaigns" ("tenant_id", "ad_account_id");

CREATE TABLE IF NOT EXISTS "meta_ad_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "campaign_id" text NOT NULL,
  "ad_set_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PAUSED',
  "targeting" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_sets_tenant_adset_unique" ON "meta_ad_sets" ("tenant_id", "ad_set_id");
CREATE INDEX IF NOT EXISTS "meta_ad_sets_campaign_idx" ON "meta_ad_sets" ("tenant_id", "campaign_id");

CREATE TABLE IF NOT EXISTS "meta_ads" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ad_set_id" text NOT NULL,
  "ad_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PAUSED',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ads_tenant_ad_unique" ON "meta_ads" ("tenant_id", "ad_id");
CREATE INDEX IF NOT EXISTS "meta_ads_ad_set_idx" ON "meta_ads" ("tenant_id", "ad_set_id");

CREATE TABLE IF NOT EXISTS "meta_lead_forms" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "page_id" text NOT NULL,
  "form_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "locale" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_lead_forms_tenant_form_unique" ON "meta_lead_forms" ("tenant_id", "form_id");
CREATE INDEX IF NOT EXISTS "meta_lead_forms_page_idx" ON "meta_lead_forms" ("tenant_id", "page_id");

CREATE TABLE IF NOT EXISTS "meta_pixels" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "pixel_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_pixels_tenant_pixel_unique" ON "meta_pixels" ("tenant_id", "pixel_id");

CREATE TABLE IF NOT EXISTS "meta_datasets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "dataset_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_datasets_tenant_dataset_unique" ON "meta_datasets" ("tenant_id", "dataset_id");

CREATE TABLE IF NOT EXISTS "meta_sync_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sync_type" text NOT NULL,
  "status" text NOT NULL,
  "items_synced" integer NOT NULL DEFAULT 0,
  "error_details" text,
  "duration_ms" integer,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "meta_sync_logs_tenant_started_idx" ON "meta_sync_logs" ("tenant_id", "started_at");

CREATE TABLE IF NOT EXISTS "meta_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" text NOT NULL DEFAULT 'meta_ads',
  "external_event_id" text,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'received',
  "error_code" text,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "meta_webhook_events_tenant_idx" ON "meta_webhook_events" ("tenant_id", "received_at");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_webhook_events_external_unique" ON "meta_webhook_events" ("external_event_id");
