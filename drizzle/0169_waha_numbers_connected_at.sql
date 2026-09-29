-- Company-number warm-up counts from when the phone was paired, not from when
-- the row was created (the row is reused when a new QR is generated).
ALTER TABLE waha_numbers
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;
--> statement-breakpoint
UPDATE waha_numbers SET connected_at = created_at
  WHERE connected_at IS NULL AND status IN ('active', 'ready');
