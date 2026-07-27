CREATE TYPE "public"."plan_type" AS ENUM('individual', 'empresarial', 'familiar', 'pme');--> statement-breakpoint
CREATE TABLE "carrier_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"carrier_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"description" text,
	"coverage" text,
	"ans_registration" text,
	"max_entry_age" integer,
	"details" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"ans_code" text,
	"contact" text,
	"phone" text,
	"email" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carrier_plans_tenant_id_idx" ON "carrier_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "carrier_plans_carrier_id_idx" ON "carrier_plans" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carriers_tenant_id_idx" ON "carriers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_tenant_name_unique" ON "carriers" USING btree ("tenant_id","name");