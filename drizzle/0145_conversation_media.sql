ALTER TABLE "whatsapp_messages" ADD COLUMN "media_kind" text;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_mime_type" text;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_filename" text;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_size_bytes" integer;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_storage_key" text;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_provider_id" text;
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_sha256" text;
