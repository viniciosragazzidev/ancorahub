-- Follow-up is configurable in /qualificacao but cannot send outbound messages
-- until LGPD, Meta templates and the 24-hour conversation window are approved.
ALTER TABLE "ai_qualification_followup_rules"
  ALTER COLUMN "enabled" SET DEFAULT false;

UPDATE "ai_qualification_followup_rules"
SET "enabled" = false
WHERE "enabled" = true;
