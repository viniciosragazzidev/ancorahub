CREATE TYPE "public"."availability_status" AS ENUM('available', 'paused');
--> statement-breakpoint
CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive');
--> statement-breakpoint
CREATE TYPE "public"."commission_rule_type" AS ENUM('unica', 'escalonada');
--> statement-breakpoint
CREATE TYPE "public"."commission_schedule_status" AS ENUM('pending', 'paid', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."goal_scope" AS ENUM('broker', 'team', 'branch', 'tenant');
--> statement-breakpoint
CREATE TYPE "public"."goal_target_type" AS ENUM('sales_count', 'revenue', 'conversion_rate', 'leads_contacted');
--> statement-breakpoint
CREATE TYPE "public"."lead_interaction_type" AS ENUM('status_change', 'note', 'system_alert', 'document_upload', 'document_review', 'quote_generated', 'whatsapp_msg');
--> statement-breakpoint
CREATE TYPE "public"."lead_origin" AS ENUM('manual', 'webhook');
--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis', 'converted', 'lost');
--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive');
--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('individual', 'empresarial', 'familiar', 'pme');
--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'shared', 'sent', 'accepted', 'expired');
--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('active', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'urgent');
--> statement-breakpoint
CREATE TYPE "public"."tenant_role" AS ENUM('director', 'manager', 'broker');
--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'inactive', 'delinquent');
--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled');
--> statement-breakpoint
CREATE TYPE "public"."webhook_credential_status" AS ENUM('active', 'revoked');
--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('received', 'processed', 'rejected', 'failed');
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text NOT NULL,
	"acao" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"status" "branch_status" DEFAULT 'active' NOT NULL,
	"accepting_leads" boolean DEFAULT true NOT NULL,
	"auto_distribute" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_id_tenant_id_unique" UNIQUE("id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "carrier_plan_networks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"specialty" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_plan_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"age_band" text NOT NULL,
	"monthly_price" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"branch_id" text,
	"corretor_id" text,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "document_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"carrier_id" text,
	"plan_id" text,
	"name" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT true NOT NULL,
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
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"invited_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "lead_distribution_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"from_branch_id" text,
	"to_branch_id" text,
	"from_queue_id" text,
	"to_queue_id" text,
	"previous_owner_id" text,
	"new_owner_id" text,
	"action" text NOT NULL,
	"source" text NOT NULL,
	"strategy" text,
	"reason" text,
	"actor_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_distribution_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text,
	"queue_id" text,
	"automatic_routing_enabled" boolean DEFAULT true NOT NULL,
	"automatic_assignment_enabled" boolean DEFAULT true NOT NULL,
	"default_queue_id" text,
	"fallback_queue_id" text,
	"allow_manager_manual_assignment" boolean DEFAULT true NOT NULL,
	"allow_director_manual_assignment" boolean DEFAULT true NOT NULL,
	"duty_schedule_enabled" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"requirement_id" text,
	"filename" text NOT NULL,
	"file_url" text NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tipo" "lead_interaction_type" NOT NULL,
	"conteudo" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_queues" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assignment_mode" text DEFAULT 'automatic' NOT NULL,
	"assignment_strategy" text DEFAULT 'capacity' NOT NULL,
	"capacity_enabled" boolean DEFAULT false NOT NULL,
	"capacity_per_broker" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_task_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_task_assignees_task_user_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "lead_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"assigned_to" text,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_webhook_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text,
	"name" text NOT NULL,
	"source" text DEFAULT 'webhook' NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "webhook_credential_status" DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_webhook_credentials_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text,
	"corretor_id" text,
	"plan_id" text,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"origem" "lead_origin" DEFAULT 'manual' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"distribution_status" text DEFAULT 'unassigned' NOT NULL,
	"queue_id" text,
	"unit_assigned_at" timestamp with time zone,
	"assignment_source" text,
	"assignment_strategy" text,
	"distribution_updated_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"first_contact_at" timestamp with time zone,
	"service_started_at" timestamp with time zone,
	"service_started_by" text,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consentimento_lgpd" boolean DEFAULT false NOT NULL,
	"motivo_perda" text,
	"external_id" text,
	"webhook_credential_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"lead_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"monthly_price" numeric(12, 2) NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"created_by" text NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"lives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"public_token" text NOT NULL,
	"shared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_public_token_unique" UNIQUE("public_token")
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
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"branch_id" text,
	"role" "tenant_role" NOT NULL,
	"job_title" text DEFAULT 'broker' NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"availability_status" "availability_status" DEFAULT 'available' NOT NULL,
	"onboarding_dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text,
	"cnpj" text,
	"logo_url" text,
	"brand_color" text,
	"subscription_plan" text DEFAULT 'Essencial' NOT NULL,
	"sla_first_contact_minutes" text DEFAULT '15' NOT NULL,
	"sla_stagnant_days" text DEFAULT '3' NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit_duty_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"queue_id" text NOT NULL,
	"name" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"request_id" text NOT NULL,
	"idempotency_key" text,
	"external_id" text,
	"payload_hash" text NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'received' NOT NULL,
	"lead_id" text,
	"error_code" text,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"session_id" text,
	"session_name" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"qr_code" text,
	"webhook_secret" text,
	"chat_interno_ativo" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text,
	"client_id" text,
	"message_id" text,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plan_networks" ADD CONSTRAINT "carrier_plan_networks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plan_networks" ADD CONSTRAINT "carrier_plan_networks_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plan_prices" ADD CONSTRAINT "carrier_plan_prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plan_prices" ADD CONSTRAINT "carrier_plan_prices_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_corretor_id_user_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_queue_id_lead_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."lead_queues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_requirement_id_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirements"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_queues" ADD CONSTRAINT "lead_queues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_queues" ADD CONSTRAINT "lead_queues_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_task_id_lead_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_corretor_id_user_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_started_by_user_id_fk" FOREIGN KEY ("service_started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_webhook_credential_id_lead_webhook_credentials_id_fk" FOREIGN KEY ("webhook_credential_id") REFERENCES "public"."lead_webhook_credentials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_carrier_plan_id_carrier_plans_id_fk" FOREIGN KEY ("carrier_plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_commission_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_branch_tenant_fk" FOREIGN KEY ("branch_id","tenant_id") REFERENCES "public"."branches"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_queue_id_lead_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."lead_queues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_credential_id_lead_webhook_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."lead_webhook_credentials"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "branches_tenant_id_idx" ON "branches" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_external_id_unique" ON "branches" USING btree ("tenant_id","external_id") WHERE "branches"."external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "carrier_plan_networks_plan_city_idx" ON "carrier_plan_networks" USING btree ("plan_id","city");
--> statement-breakpoint
CREATE UNIQUE INDEX "carrier_plan_prices_plan_age_unique" ON "carrier_plan_prices" USING btree ("plan_id","age_band");
--> statement-breakpoint
CREATE INDEX "carrier_plans_tenant_id_idx" ON "carrier_plans" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "carrier_plans_carrier_id_idx" ON "carrier_plans" USING btree ("carrier_id");
--> statement-breakpoint
CREATE INDEX "carriers_tenant_id_idx" ON "carriers" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_tenant_name_unique" ON "carriers" USING btree ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_lead_unique" ON "clients" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "clients_corretor_idx" ON "clients" USING btree ("corretor_id");
--> statement-breakpoint
CREATE INDEX "commission_rules_tenant_idx" ON "commission_rules" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "commission_rules_carrier_idx" ON "commission_rules" USING btree ("carrier_id");
--> statement-breakpoint
CREATE INDEX "commission_rules_plan_idx" ON "commission_rules" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "commission_schedule_tenant_idx" ON "commission_schedule" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "commission_schedule_sale_idx" ON "commission_schedule" USING btree ("sale_id");
--> statement-breakpoint
CREATE INDEX "commission_schedule_ref_month_idx" ON "commission_schedule" USING btree ("reference_month");
--> statement-breakpoint
CREATE INDEX "commission_schedule_status_idx" ON "commission_schedule" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "document_requirements_tenant_idx" ON "document_requirements" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "goal_progress_goal_unique" ON "goal_progress" USING btree ("goal_id");
--> statement-breakpoint
CREATE INDEX "goals_tenant_scope_idx" ON "goals" USING btree ("tenant_id","scope");
--> statement-breakpoint
CREATE INDEX "goals_period_idx" ON "goals" USING btree ("tenant_id","period");
--> statement-breakpoint
CREATE INDEX "invites_user_id_idx" ON "invites" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "invites_token_hash_idx" ON "invites" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "lead_distribution_events_tenant_lead_idx" ON "lead_distribution_events" USING btree ("tenant_id","lead_id","created_at");
--> statement-breakpoint
CREATE INDEX "lead_distribution_settings_tenant_idx" ON "lead_distribution_settings" USING btree ("tenant_id","branch_id","queue_id");
--> statement-breakpoint
CREATE INDEX "lead_documents_tenant_lead_idx" ON "lead_documents" USING btree ("tenant_id","lead_id");
--> statement-breakpoint
CREATE INDEX "lead_interactions_lead_created_idx" ON "lead_interactions" USING btree ("lead_id","created_at");
--> statement-breakpoint
CREATE INDEX "lead_queues_tenant_branch_idx" ON "lead_queues" USING btree ("tenant_id","branch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "lead_queues_tenant_branch_slug_unique" ON "lead_queues" USING btree ("tenant_id","branch_id","slug");
--> statement-breakpoint
CREATE INDEX "lead_task_assignees_tenant_user_idx" ON "lead_task_assignees" USING btree ("tenant_id","user_id");
--> statement-breakpoint
CREATE INDEX "lead_tasks_tenant_lead_idx" ON "lead_tasks" USING btree ("tenant_id","lead_id");
--> statement-breakpoint
CREATE INDEX "lead_tasks_assigned_due_idx" ON "lead_tasks" USING btree ("assigned_to","due_at");
--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_tenant_id_idx" ON "lead_webhook_credentials" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_branch_id_idx" ON "lead_webhook_credentials" USING btree ("branch_id");
--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_created_by_idx" ON "lead_webhook_credentials" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX "leads_tenant_branch_status_idx" ON "leads" USING btree ("tenant_id","branch_id","status");
--> statement-breakpoint
CREATE INDEX "leads_tenant_distribution_status_idx" ON "leads" USING btree ("tenant_id","distribution_status");
--> statement-breakpoint
CREATE INDEX "leads_branch_queue_distribution_idx" ON "leads" USING btree ("branch_id","queue_id","distribution_status");
--> statement-breakpoint
CREATE INDEX "leads_corretor_status_idx" ON "leads" USING btree ("corretor_id","status");
--> statement-breakpoint
CREATE INDEX "leads_webhook_credential_idx" ON "leads" USING btree ("webhook_credential_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "leads_credential_external_id_unique" ON "leads" USING btree ("webhook_credential_id","external_id") WHERE "leads"."external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "platform_audit_logs_actor_idx" ON "platform_audit_logs" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_tenant_idx" ON "push_subscriptions" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");
--> statement-breakpoint
CREATE INDEX "quotes_tenant_lead_idx" ON "quotes" USING btree ("tenant_id","lead_id");
--> statement-breakpoint
CREATE INDEX "quotes_public_token_idx" ON "quotes" USING btree ("public_token");
--> statement-breakpoint
CREATE INDEX "sales_tenant_idx" ON "sales" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "sales_lead_idx" ON "sales" USING btree ("lead_id");
--> statement-breakpoint
CREATE INDEX "sales_broker_idx" ON "sales" USING btree ("broker_id");
--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "tenant_memberships_branch_id_idx" ON "tenant_memberships" USING btree ("branch_id");
--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "twoFactor" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "unit_duty_schedules_tenant_status_idx" ON "unit_duty_schedules" USING btree ("tenant_id","status","day_of_week","starts_at");
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_tenant_id_idx" ON "webhook_deliveries" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_credential_id_idx" ON "webhook_deliveries" USING btree ("credential_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_credential_idempotency_unique" ON "webhook_deliveries" USING btree ("credential_id","idempotency_key") WHERE "webhook_deliveries"."idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "whatsapp_connections_user_idx" ON "whatsapp_connections" USING btree ("tenant_id","user_id");
--> statement-breakpoint
CREATE INDEX "whatsapp_connections_session_idx" ON "whatsapp_connections" USING btree ("session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_tenant_user_unique" ON "whatsapp_connections" USING btree ("tenant_id","user_id") WHERE "whatsapp_connections"."user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "whatsapp_messages_tenant_lead_idx" ON "whatsapp_messages" USING btree ("tenant_id","lead_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_message_unique" ON "whatsapp_messages" USING btree ("tenant_id","message_id");
--> statement-breakpoint
