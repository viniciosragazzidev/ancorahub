CREATE TABLE IF NOT EXISTS "lead_routing_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT true,
  "conditions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "target_type" text NOT NULL DEFAULT 'queue',
  "target_id" text NOT NULL,
  "fallback_queue_id" text REFERENCES "lead_queues"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "lead_routing_rules_tenant_idx"
  ON "lead_routing_rules" ("tenant_id", "enabled", "priority");
