-- A source can be removed without erasing the historical lead it originated.
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_webhook_credential_id_lead_webhook_credentials_id_fk";
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_webhook_credential_id_lead_webhook_credentials_id_fk"
  FOREIGN KEY ("webhook_credential_id") REFERENCES "lead_webhook_credentials"("id") ON DELETE SET NULL;
