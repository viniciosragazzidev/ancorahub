ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "sla_breached_at" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_contact_latency_seconds" integer;
