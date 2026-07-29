CREATE TABLE IF NOT EXISTS "meta_lead_ad_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "page_id" text NOT NULL,
  "ad_account_id" text,
  "lead_webhook_credential_id" text NOT NULL REFERENCES "lead_webhook_credentials"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'active',
  "last_webhook_at" timestamp with time zone,
  "last_lead_at" timestamp with time zone,
  "last_error" text,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_lead_ad_sources_page_unique" ON "meta_lead_ad_sources" ("page_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_lead_ad_sources_credential_unique" ON "meta_lead_ad_sources" ("lead_webhook_credential_id");
CREATE INDEX IF NOT EXISTS "meta_lead_ad_sources_tenant_status_idx" ON "meta_lead_ad_sources" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "meta_lead_ad_sources_branch_idx" ON "meta_lead_ad_sources" ("branch_id");
