-- Team notices and delivery guard (DEC-125, 2026-09-27).
-- One row per tenant and team notice: on/off and the primary channel. Missing
-- rows fall back to the catalog defaults in code. A disabled notice is never
-- sent (the outbox row is kept as 'skipped' with the reason).
CREATE TABLE IF NOT EXISTS team_notice_settings (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notice_key text NOT NULL,
  enabled boolean NOT NULL,
  channel text NOT NULL CHECK (channel IN ('company_number', 'meta')),
  free_message_id text REFERENCES message_templates(id) ON DELETE SET NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, notice_key)
);
--> statement-breakpoint
-- Why a row is waiting (quiet hours, pacing, limits) or was skipped.
ALTER TABLE whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS notice_key text;
--> statement-breakpoint
-- Company-number protection: spacing slot and circuit breaker.
ALTER TABLE waha_numbers
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS whatsapp_outbound_messages_recipient_sent_idx
  ON whatsapp_outbound_messages (tenant_id, recipient_id, sent_at)
  WHERE sent_at IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS whatsapp_outbound_messages_waha_sent_idx
  ON whatsapp_outbound_messages (waha_number_id, sent_at)
  WHERE sent_at IS NOT NULL;
