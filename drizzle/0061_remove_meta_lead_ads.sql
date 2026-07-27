-- Remove the retired Meta Lead Ads/Pixel intake storage. WhatsApp Meta tables
-- are intentionally untouched.
DROP TABLE IF EXISTS "marketing_daily_metrics" CASCADE;
DROP TABLE IF EXISTS "marketing_webhook_events" CASCADE;
DROP TABLE IF EXISTS "marketing_connections" CASCADE;
