CREATE TABLE IF NOT EXISTS "meta_ad_queue_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ad_id" text NOT NULL,
  "queue_id" text REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_queue_routes_tenant_ad_unique" ON "meta_ad_queue_routes" ("tenant_id", "ad_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_ad_queue_routes_queue_idx" ON "meta_ad_queue_routes" ("tenant_id", "queue_id");
