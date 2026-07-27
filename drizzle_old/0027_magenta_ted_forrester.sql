CREATE TYPE "public"."commission_rule_type" AS ENUM('unica', 'escalonada');--> statement-breakpoint
CREATE TYPE "public"."commission_schedule_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."goal_scope" AS ENUM('broker', 'team', 'branch', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."goal_target_type" AS ENUM('sales_count', 'revenue', 'conversion_rate', 'leads_contacted');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"carrier_id" text,
	"plan_id" text,
	"name" text NOT NULL,
	"type" "commission_rule_type" DEFAULT 'escalonada' NOT NULL,
	"percentages" jsonb DEFAULT '[100]'::jsonb NOT NULL,
	"applies_to_all" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"month_number" integer NOT NULL,
	"reference_month" text NOT NULL,
	"due_date" timestamp with time zone,
	"percentage" numeric(5, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "commission_schedule_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"current_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"scope" "goal_scope" NOT NULL,
	"scope_id" text,
	"name" text NOT NULL,
	"target_type" "goal_target_type" DEFAULT 'sales_count' NOT NULL,
	"target_value" numeric(12, 2) NOT NULL,
	"period" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"client_id" text,
	"broker_id" text NOT NULL,
	"carrier_plan_id" text,
	"commission_rule_id" text,
	"sale_date" timestamp with time zone NOT NULL,
	"sale_value" numeric(12, 2) NOT NULL,
	"status" "sale_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_carrier_plan_id_carrier_plans_id_fk" FOREIGN KEY ("carrier_plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_commission_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_rules_tenant_idx" ON "commission_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_rules_carrier_idx" ON "commission_rules" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "commission_rules_plan_idx" ON "commission_rules" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_tenant_idx" ON "commission_schedule" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_sale_idx" ON "commission_schedule" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_ref_month_idx" ON "commission_schedule" USING btree ("reference_month");--> statement-breakpoint
CREATE INDEX "commission_schedule_status_idx" ON "commission_schedule" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_progress_goal_unique" ON "goal_progress" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goals_tenant_scope_idx" ON "goals" USING btree ("tenant_id","scope");--> statement-breakpoint
CREATE INDEX "goals_period_idx" ON "goals" USING btree ("tenant_id","period");--> statement-breakpoint
CREATE INDEX "sales_tenant_idx" ON "sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_lead_idx" ON "sales" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sales_broker_idx" ON "sales" USING btree ("broker_id");