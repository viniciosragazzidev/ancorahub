-- Preserve the exact plantão occurrence represented when an offer or assignment is made.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duty_schedule_id text;
ALTER TABLE lead_offers ADD COLUMN IF NOT EXISTS duty_schedule_id text;
ALTER TABLE lead_assignment_attempts ADD COLUMN IF NOT EXISTS duty_schedule_id text;
