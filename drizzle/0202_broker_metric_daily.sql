CREATE TABLE IF NOT EXISTS "broker_metric_daily" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "supervisor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "snapshot_day" date NOT NULL,
  "window_start" date NOT NULL,
  "window_end" date NOT NULL,
  "metrics" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "broker_metric_daily_tenant_broker_day_unique" UNIQUE ("tenant_id", "broker_id", "snapshot_day")
);

CREATE INDEX IF NOT EXISTS "broker_metric_daily_tenant_day_idx"
  ON "broker_metric_daily" ("tenant_id", "snapshot_day");
