-- Keeps queue-level duty restrictions optional. Existing queues keep their
-- current behaviour until a Director explicitly selects a schedule.
ALTER TABLE "lead_queues"
  ADD COLUMN IF NOT EXISTS "exclusive_duty_schedule_id" text;

CREATE INDEX IF NOT EXISTS "lead_queues_exclusive_duty_schedule_idx"
  ON "lead_queues" ("tenant_id", "exclusive_duty_schedule_id")
  WHERE "exclusive_duty_schedule_id" IS NOT NULL;
