ALTER TABLE "lead_queues"
  ADD COLUMN IF NOT EXISTS "exclusive_duty_schedule_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "lead_queues"
SET "exclusive_duty_schedule_ids" = jsonb_build_array("exclusive_duty_schedule_id")
WHERE "exclusive_duty_schedule_id" IS NOT NULL
  AND jsonb_array_length("exclusive_duty_schedule_ids") = 0;
