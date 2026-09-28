-- Lead removed from distribution by a director/manager (definitive: only a
-- manual assignment to a broker brings it back). The engine never offers it.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_removed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_removal_reason" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_removal_note" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_removed_by" text REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_distribution_removal_reason_check";
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_distribution_removal_reason_check"
  CHECK ("distribution_removal_reason" IS NULL OR "distribution_removal_reason" IN ('disqualified_no_value', 'external_broker_transfer'));
