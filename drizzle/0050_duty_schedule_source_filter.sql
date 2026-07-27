-- Plantões podem ser filtrados por origem do lead (webhook credential).
-- NULL = todas as origens (comportamento padrão).
ALTER TABLE "unit_duty_schedules"
  ADD COLUMN "webhook_credential_id" text
  REFERENCES "lead_webhook_credentials"("id") ON DELETE SET NULL;
