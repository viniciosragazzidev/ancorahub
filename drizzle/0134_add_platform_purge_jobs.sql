CREATE TABLE "platform_purge_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_leads" integer DEFAULT 0,
	"deleted_leads" integer DEFAULT 0,
	"total_conversations" integer DEFAULT 0,
	"deleted_conversations" integer DEFAULT 0,
	"current_phase" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "platform_purge_jobs" ADD CONSTRAINT "platform_purge_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_purge_jobs" ADD CONSTRAINT "platform_purge_jobs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_purge_jobs_tenant_idx" ON "platform_purge_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_purge_jobs_status_idx" ON "platform_purge_jobs" USING btree ("status");
