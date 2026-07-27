CREATE TABLE IF NOT EXISTS "duty_roster_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "schedule_id" text NOT NULL REFERENCES "unit_duty_schedules"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "valid_from" timestamptz NOT NULL,
  "valid_until" timestamptz,
  "status" text NOT NULL DEFAULT 'active',
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "updated_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "duty_roster_assignments_tenant_branch_idx" ON "duty_roster_assignments" ("tenant_id", "branch_id", "day_of_week", "starts_at");
CREATE INDEX IF NOT EXISTS "duty_roster_assignments_broker_idx" ON "duty_roster_assignments" ("tenant_id", "broker_id", "day_of_week");
CREATE INDEX IF NOT EXISTS "duty_roster_assignments_schedule_idx" ON "duty_roster_assignments" ("schedule_id", "status");
