ALTER TABLE "lead_queues"
  ADD COLUMN IF NOT EXISTS "duty_fallback_policy" text NOT NULL DEFAULT 'unit_roster';

ALTER TABLE "lead_queues"
  ADD COLUMN IF NOT EXISTS "duty_fallback_queue_id" text;

ALTER TABLE "lead_queues"
  ADD CONSTRAINT "lead_queues_duty_fallback_policy_check"
  CHECK ("duty_fallback_policy" IN ('unit_roster', 'wait_next_duty', 'fallback_queue'));

CREATE INDEX IF NOT EXISTS "lead_queues_duty_fallback_queue_idx"
  ON "lead_queues" ("tenant_id", "duty_fallback_queue_id");
