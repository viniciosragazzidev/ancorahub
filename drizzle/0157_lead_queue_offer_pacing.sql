ALTER TABLE "lead_queues" ADD COLUMN IF NOT EXISTS "offer_interval_minutes" integer NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE "lead_queues" ADD COLUMN IF NOT EXISTS "max_pending_offers_per_broker" integer NOT NULL DEFAULT 1;
