-- ai_attendance_logs keeps a legacy "ai_conversation_id" column (NOT NULL, no
-- default) that the code never writes: the conversation goes in
-- "conversation_id". It made every usage insert fail. Optional from now on.
ALTER TABLE ai_attendance_logs ALTER COLUMN ai_conversation_id DROP NOT NULL;
