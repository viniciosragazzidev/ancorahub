-- Persiste a sessao WAHA que originou cada mensagem para separar conexoes
-- pessoais dos numeros corporativos na metrica de respostas recentes.
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "whatsapp_connection_id" text;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "waha_number_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_whatsapp_connection_id_whatsapp_connections_id_fk'
      AND conrelid = 'public.whatsapp_messages'::regclass
  ) THEN
    ALTER TABLE "public"."whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_whatsapp_connection_id_whatsapp_connections_id_fk"
      FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connections"("id") ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_waha_number_id_waha_numbers_id_fk'
      AND conrelid = 'public.whatsapp_messages'::regclass
  ) THEN
    ALTER TABLE "public"."whatsapp_messages"
      ADD CONSTRAINT "whatsapp_messages_waha_number_id_waha_numbers_id_fk"
      FOREIGN KEY ("waha_number_id") REFERENCES "public"."waha_numbers"("id") ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
-- NOT VALID + VALIDATE: checks existing rows without blocking inserts into the table.
ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_whatsapp_connection_id_whatsapp_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "public"."whatsapp_messages" VALIDATE CONSTRAINT "whatsapp_messages_waha_number_id_waha_numbers_id_fk";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_messages_tenant_connection_sent_idx"
  ON "whatsapp_messages" USING btree ("tenant_id", "whatsapp_connection_id", "sent_at" DESC)
  WHERE "whatsapp_connection_id" IS NOT NULL;
