ALTER TABLE "whatsapp_outbound_messages"
  ADD COLUMN IF NOT EXISTS "message_type" text NOT NULL DEFAULT 'template';

CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_type_idx"
  ON "whatsapp_outbound_messages" ("tenant_id", "purpose", "message_type", "created_at");
