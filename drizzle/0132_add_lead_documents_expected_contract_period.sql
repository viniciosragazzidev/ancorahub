ALTER TABLE "lead_documents" ADD COLUMN IF NOT EXISTS "coverage_start_date" date;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD COLUMN IF NOT EXISTS "expiration_date" date;