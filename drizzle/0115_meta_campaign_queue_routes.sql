CREATE TABLE IF NOT EXISTS "meta_campaign_queue_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "campaign_id" text NOT NULL,
  "queue_id" text NOT NULL REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meta_campaign_queue_routes_tenant_campaign_unique" UNIQUE ("tenant_id", "campaign_id")
);

CREATE INDEX IF NOT EXISTS "meta_campaign_queue_routes_queue_idx"
  ON "meta_campaign_queue_routes" ("tenant_id", "queue_id");
