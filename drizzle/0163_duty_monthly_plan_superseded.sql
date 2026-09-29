-- A month can be staffed again after it was published (2026-09-26): publishing
-- a newer revision replaces the dates that have not ended yet, and the previous
-- published revision is kept as history with status 'superseded'. Only one
-- revision per month stays 'published' (duty_schedule_monthly_plans_one_published).
ALTER TABLE duty_schedule_monthly_plans DROP CONSTRAINT IF EXISTS duty_schedule_monthly_plans_status_check;
--> statement-breakpoint
ALTER TABLE duty_schedule_monthly_plans
  ADD CONSTRAINT duty_schedule_monthly_plans_status_check CHECK (status IN ('draft', 'published', 'superseded'));
