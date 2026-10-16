CREATE TABLE IF NOT EXISTS "waha_group_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL,
  "provider_message_id" text NOT NULL,
  "author_phone_hash" text,
  "message_type" text DEFAULT 'text' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "file_name" text,
  "mime_type" text,
  "knowledge_document_id" text REFERENCES "knowledge_documents"("id") ON DELETE SET NULL,
  "capture_status" text DEFAULT 'captured' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_group_messages_tenant_message_unique" ON "waha_group_messages" ("tenant_id", "provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_group_messages_tenant_group_idx" ON "waha_group_messages" ("tenant_id", "group_id");
