-- Schema changes for Meta Lead Ads run only through the deployment migration.
-- Never execute DDL from a request path: these tables are shared by every tenant.

ALTER TABLE "meta_campaign_queue_routes"
  ALTER COLUMN "queue_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "meta_lead_ad_sources"
  ADD COLUMN IF NOT EXISTS "distribution_mode" text NOT NULL DEFAULT 'direct_leads';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "meta_form_queue_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "form_id" text NOT NULL,
  "queue_id" text REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "meta_form_queue_routes_tenant_form_unique" UNIQUE ("tenant_id", "form_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "meta_form_queue_routes_queue_idx"
  ON "meta_form_queue_routes" ("tenant_id", "queue_id");
