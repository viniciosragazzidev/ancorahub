CREATE TABLE IF NOT EXISTS "duty_presence_confirmations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "schedule_id" text NOT NULL REFERENCES "unit_duty_schedules"("id") ON DELETE CASCADE,
  "assignment_id" text NOT NULL REFERENCES "duty_roster_assignments"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "duty_date" date NOT NULL,
  "shift_starts_at" timestamptz NOT NULL,
  "shift_ends_at" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "confirmed_at" timestamptz,
  "notification_status" text NOT NULL DEFAULT 'pending',
  "notification_error_code" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "duty_presence_status_check" CHECK ("status" IN ('pending', 'confirmed', 'expired')),
  CONSTRAINT "duty_presence_notification_status_check" CHECK ("notification_status" IN ('pending', 'dispatching', 'queued', 'sent', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "duty_presence_occurrence_assignment_unique"
  ON "duty_presence_confirmations" ("tenant_id", "assignment_id", "duty_date", "shift_starts_at", "shift_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_presence_schedule_date_idx"
  ON "duty_presence_confirmations" ("tenant_id", "schedule_id", "duty_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_presence_broker_date_idx"
  ON "duty_presence_confirmations" ("tenant_id", "broker_id", "duty_date", "status");
