-- Existing schedules remain online. In-person schedules require a manager's
-- occurrence check-in; absence uses the existing per-occurrence presence row.
ALTER TABLE unit_duty_schedules
  ADD COLUMN IF NOT EXISTS attendance_mode text NOT NULL DEFAULT 'online';

ALTER TABLE unit_duty_schedules
  ADD CONSTRAINT unit_duty_schedules_attendance_mode_check
  CHECK (attendance_mode IN ('online', 'presencial')) NOT VALID;

ALTER TABLE unit_duty_schedules
  VALIDATE CONSTRAINT unit_duty_schedules_attendance_mode_check;

ALTER TABLE duty_presence_confirmations
  DROP CONSTRAINT IF EXISTS duty_presence_status_check;

ALTER TABLE duty_presence_confirmations
  ADD CONSTRAINT duty_presence_status_check
  CHECK (status IN ('pending', 'confirmed', 'expired', 'absent')) NOT VALID;

ALTER TABLE duty_presence_confirmations
  VALIDATE CONSTRAINT duty_presence_status_check;
