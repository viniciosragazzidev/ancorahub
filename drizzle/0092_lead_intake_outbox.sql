-- Durable effects for webhook intake. A lead and its pending effects commit
-- together, so a transient provider failure cannot erase operational work.
CREATE TABLE IF NOT EXISTS "lead_effect_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "webhook_delivery_id" text REFERENCES "webhook_deliveries"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "idempotency_key" text NOT NULL,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 8,
  "run_after" timestamptz NOT NULL DEFAULT now(),
  "locked_at" timestamptz,
  "locked_by" text,
  "lease_expires_at" timestamptz,
  "last_error_code" text,
  "last_error_message" text,
  "completed_at" timestamptz,
  "failed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_effect_outbox_tenant_idempotency_unique"
  ON "lead_effect_outbox" ("tenant_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_effect_outbox_due_idx"
  ON "lead_effect_outbox" ("status", "run_after");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_effect_outbox_tenant_lead_idx"
  ON "lead_effect_outbox" ("tenant_id", "lead_id", "created_at");
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_tenant_idempotency_unique"
  ON "notifications" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "system_settings" ("key", "value") VALUES
  ('feature_lead_intake_outbox_enabled', 'true'),
  ('lead_intake_outbox_max_attempts', '8'),
  ('lead_intake_outbox_retry_base_seconds', '60'),
  ('lead_intake_outbox_lease_seconds', '120')
ON CONFLICT ("key") DO NOTHING;
