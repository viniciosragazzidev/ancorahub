ALTER TABLE "leads" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "service_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "service_started_by" text;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_started_by_user_id_fk" FOREIGN KEY ("service_started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;