-- Broker Lite reads WhatsApp messages per conversation ordered by sent_at:
--   * Início: the latest message of each active lead (lateral + limit 1);
--   * the lead screen: the last 100 messages of one lead;
--   * Conversas/Insights: the latest messages of the broker's leads and clients.
-- The only per-lead index is (tenant_id, lead_id, created_at), so every read
-- fetched the whole history of the conversation and sorted it by sent_at.
-- These indexes let Postgres walk each conversation newest first and stop.
--
-- Run each statement on its own in the Supabase SQL editor (CONCURRENTLY
-- cannot run inside a transaction block).
CREATE INDEX CONCURRENTLY IF NOT EXISTS whatsapp_messages_tenant_lead_sent_idx
  ON whatsapp_messages (tenant_id, lead_id, sent_at DESC)
  WHERE lead_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS whatsapp_messages_tenant_client_sent_idx
  ON whatsapp_messages (tenant_id, client_id, sent_at DESC)
  WHERE client_id IS NOT NULL;
