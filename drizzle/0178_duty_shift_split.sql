-- A plantão split in a morning and an afternoon shift (e.g. at 13:30). Each
-- broker's roster window (duty_roster_assignments.starts_at/ends_at) is their
-- shift, which the distribution and the presence call already follow.
ALTER TABLE unit_duty_schedules ADD COLUMN IF NOT EXISTS shift_split_at text;
