-- Published monthly duty occurrences live in duty_roster_assignments (presence
-- confirmations and every resolver key on that table) but are explicitly
-- marked: duty_date + monthly_plan_id. Weekly rows keep both NULL, so the
-- weekly roster and its checks can ignore dated rows entirely.
ALTER TABLE "duty_roster_assignments"
  ADD COLUMN IF NOT EXISTS "duty_date" date,
  ADD COLUMN IF NOT EXISTS "monthly_plan_id" text REFERENCES "duty_schedule_monthly_plans"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_roster_assignments_dated_idx"
  ON "duty_roster_assignments" ("tenant_id", "duty_date", "schedule_id")
  WHERE "duty_date" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "duty_roster_assignments_dated_unique"
  ON "duty_roster_assignments" ("tenant_id", "duty_date", "schedule_id", "broker_id")
  WHERE "duty_date" IS NOT NULL AND "status" = 'active';
--> statement-breakpoint
-- At most one published revision per tenant and month.
CREATE UNIQUE INDEX IF NOT EXISTS "duty_schedule_monthly_plans_one_published"
  ON "duty_schedule_monthly_plans" ("tenant_id", "month_key")
  WHERE "status" = 'published';
