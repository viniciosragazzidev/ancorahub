CREATE TABLE "platform_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "cnpj" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_plan" text DEFAULT 'Essencial' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_logs_actor_idx" ON "platform_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_cnpj_unique" UNIQUE("cnpj");