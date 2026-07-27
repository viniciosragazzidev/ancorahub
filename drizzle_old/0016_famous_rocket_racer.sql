ALTER TABLE "tenants" ADD COLUMN "sla_first_contact_minutes" text DEFAULT '15' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sla_stagnant_days" text DEFAULT '3' NOT NULL;