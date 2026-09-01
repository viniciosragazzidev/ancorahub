CREATE TABLE IF NOT EXISTS "tenant_internal_notification_settings" (
  "tenant_id" text PRIMARY KEY NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "delivery_mode" text NOT NULL DEFAULT 'meta_then_waha',
  "waha_number_id" text REFERENCES "waha_numbers"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_internal_notification_delivery_mode_check"
    CHECK ("delivery_mode" IN ('meta_then_waha', 'waha_direct'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_internal_notification_waha_idx"
  ON "tenant_internal_notification_settings" ("waha_number_id");
--> statement-breakpoint
ALTER TABLE "whatsapp_outbound_messages" ALTER COLUMN "channel_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_outbound_messages"
  ADD COLUMN IF NOT EXISTS "delivery_route" text NOT NULL DEFAULT 'meta_only';
--> statement-breakpoint
ALTER TABLE "whatsapp_outbound_messages"
  ADD COLUMN IF NOT EXISTS "waha_number_id" text REFERENCES "waha_numbers"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_outbound_messages"
  ADD CONSTRAINT "whatsapp_outbound_messages_delivery_route_check"
  CHECK ("delivery_route" IN ('meta_only', 'meta_then_waha', 'waha_direct'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_outbound_messages_waha_number_idx"
  ON "whatsapp_outbound_messages" ("waha_number_id");
