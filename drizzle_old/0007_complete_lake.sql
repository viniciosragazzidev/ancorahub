ALTER TYPE "public"."lead_status" ADD VALUE 'documentation_pending' BEFORE 'converted';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'under_analysis' BEFORE 'converted';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "motivo_perda" text;