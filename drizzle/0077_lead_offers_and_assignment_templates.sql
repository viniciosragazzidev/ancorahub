CREATE TABLE IF NOT EXISTS "lead_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
	"lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
	"broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"status" text NOT NULL DEFAULT 'PENDING',
	"offered_at" timestamptz DEFAULT now() NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"accepted_at" timestamptz,
	"declined_at" timestamptz,
	"whatsapp_message_id" text,
	"outbound_message_id" text REFERENCES "whatsapp_outbound_messages"("id") ON DELETE SET NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lead_offers_tenant_lead_status_idx" ON "lead_offers" ("tenant_id", "lead_id", "status");
CREATE INDEX IF NOT EXISTS "lead_offers_broker_status_expires_idx" ON "lead_offers" ("broker_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "lead_offers_whatsapp_msg_idx" ON "lead_offers" ("whatsapp_message_id");
