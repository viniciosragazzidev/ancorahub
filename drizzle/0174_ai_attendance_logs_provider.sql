-- ai_attendance_logs was created without the "provider" column the code writes
-- (what used the model: qualification fallback, lateral answer, situation
-- learning). Every usage insert failed silently, so no AI usage was recorded.
ALTER TABLE ai_attendance_logs ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openrouter';
