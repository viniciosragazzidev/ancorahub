ALTER TABLE "unit_duty_schedules"
  ADD COLUMN IF NOT EXISTS "minimum_brokers" integer NOT NULL DEFAULT 1;

ALTER TABLE "unit_duty_schedules"
  ADD CONSTRAINT "unit_duty_schedules_minimum_brokers_check"
  CHECK ("minimum_brokers" >= 1);
