CREATE TABLE IF NOT EXISTS "duty_schedule_types" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "duty_schedule_types_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "duty_schedule_types_name_check" CHECK (length(trim("name")) BETWEEN 2 AND 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "duty_schedule_types_tenant_name_unique"
  ON "duty_schedule_types" ("tenant_id", lower("name"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_schedule_types_tenant_status_idx"
  ON "duty_schedule_types" ("tenant_id", "status", "name");
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules"
  ADD COLUMN IF NOT EXISTS "type_id" text REFERENCES "duty_schedule_types"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "maximum_brokers" integer;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules"
  ADD CONSTRAINT "unit_duty_schedules_maximum_brokers_check"
  CHECK ("maximum_brokers" IS NULL OR "maximum_brokers" >= "minimum_brokers");
