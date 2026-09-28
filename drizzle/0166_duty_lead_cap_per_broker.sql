-- Per-plantão cap on how many leads each broker receives in one occurrence.
-- Null keeps the plantão without a cap (today's behavior).
ALTER TABLE "unit_duty_schedules" ADD COLUMN IF NOT EXISTS "max_leads_per_broker" integer;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" DROP CONSTRAINT IF EXISTS "unit_duty_schedules_max_leads_per_broker_check";
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_max_leads_per_broker_check" CHECK ("max_leads_per_broker" IS NULL OR ("max_leads_per_broker" BETWEEN 1 AND 500));
