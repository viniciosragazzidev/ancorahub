ALTER TABLE "lead_interactions" ALTER COLUMN "tipo" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."lead_interaction_type";--> statement-breakpoint
CREATE TYPE "public"."lead_interaction_type" AS ENUM('status_change', 'note', 'system_alert', 'document_upload', 'document_review', 'quote_generated', 'whatsapp_msg');--> statement-breakpoint
ALTER TABLE "lead_interactions" ALTER COLUMN "tipo" SET DATA TYPE "public"."lead_interaction_type" USING "tipo"::"public"."lead_interaction_type";--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD COLUMN "metadata" jsonb;