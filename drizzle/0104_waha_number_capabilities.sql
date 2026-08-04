ALTER TABLE "waha_numbers"
  ADD COLUMN IF NOT EXISTS "capabilities" jsonb NOT NULL DEFAULT '{"inbound":true,"cadence":false,"ai":false}'::jsonb;
