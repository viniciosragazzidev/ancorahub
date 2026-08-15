ALTER TABLE "lead_queues"
  ADD COLUMN IF NOT EXISTS "ai_qualification_enabled" boolean NOT NULL DEFAULT true;
