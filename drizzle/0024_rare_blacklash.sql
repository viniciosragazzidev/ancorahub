CREATE TYPE "public"."active_customer_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'paused');--> statement-breakpoint
CREATE TYPE "public"."beneficiary_relationship" AS ENUM('titular', 'conjuge', 'filho', 'outro');--> statement-breakpoint
CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."catalog_import_status" AS ENUM('draft', 'validating', 'ready_for_review', 'published', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."catalog_source" AS ENUM('global', 'tenant_private');--> statement-breakpoint
CREATE TYPE "public"."catalog_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."commission_rule_type" AS ENUM('unica', 'escalonada');--> statement-breakpoint
CREATE TYPE "public"."commission_schedule_status" AS ENUM('pending', 'paid', 'cancelled', 'chargeback_pending');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."goal_scope" AS ENUM('broker', 'team', 'branch', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."goal_target_type" AS ENUM('sales_count', 'revenue', 'conversion_rate', 'leads_contacted');--> statement-breakpoint
CREATE TYPE "public"."lead_interaction_type" AS ENUM('status_change', 'note', 'system_alert', 'document_upload', 'document_review', 'quote_generated', 'whatsapp_msg', 'service_started');--> statement-breakpoint
CREATE TYPE "public"."lead_origin" AS ENUM('manual', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'distributed', 'in_contact', 'quote_sent', 'negotiation', 'documentation_pending', 'under_analysis', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."marketing_connection_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('individual', 'empresarial', 'familiar', 'pme');--> statement-breakpoint
CREATE TYPE "public"."promotional_material_category" AS ENUM('todos', 'avisos', 'eventos', 'informativos', 'premiacoes', 'promocoes', 'treinamentos', 'materiais_divulgacao');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'shared', 'sent', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."tenant_role" AS ENUM('director', 'manager', 'broker');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'inactive', 'delinquent');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."webhook_credential_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('received', 'processed', 'rejected', 'failed');--> statement-breakpoint
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
CREATE TABLE "active_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"client_id" text,
	"lead_id" text NOT NULL,
	"broker_id" text NOT NULL,
	"branch_id" text,
	"status" "active_customer_status" DEFAULT 'active' NOT NULL,
	"coverage_start_date" date NOT NULL,
	"contract_anniversary" date NOT NULL,
	"cancellation_date" date,
	"cancellation_reason" text,
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
CREATE TABLE "branch_catalog_plan_restrictions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"global_plan_id" text NOT NULL,
	"restricted" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_catalog_plan_restrictions_branch_plan_unique" UNIQUE("branch_id","global_plan_id")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"source_channel" text DEFAULT 'landing_page' NOT NULL,
	"source_campaign" text,
	"source_ad" text,
	"source_form" text,
	"source_metadata" jsonb,
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
CREATE TABLE "catalog_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"tenant_id" text,
	"source" "catalog_source" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_change_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"import_batch_id" text,
	"source" "catalog_source" NOT NULL,
	"target_tenant_id" text,
	"status" "catalog_import_status" DEFAULT 'draft' NOT NULL,
	"base_version_id" text,
	"proposed_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "catalog_source" NOT NULL,
	"target_tenant_id" text,
	"status" "catalog_import_status" DEFAULT 'draft' NOT NULL,
	"file_name" text,
	"content_hash" text,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_price_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"table_version_id" text NOT NULL,
	"age_band" text NOT NULL,
	"min_age" integer,
	"max_age" integer,
	"monthly_price" numeric(12, 2) NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_price_rows_version_age_band_unique" UNIQUE("table_version_id","age_band")
);
--> statement-breakpoint
CREATE TABLE "catalog_price_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_table_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"price_table_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source_label" text,
	"content_hash" text,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_table_versions_table_number_unique" UNIQUE("price_table_id","version_number")
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
CREATE TABLE "communication_channel_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text,
	"provider" text NOT NULL,
	"external_event_id" text,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error_code" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "communication_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text,
	"owner_user_id" text,
	"provider" text NOT NULL,
	"channel_type" text DEFAULT 'shared' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"business_id" text,
	"waba_id" text,
	"phone_number_id" text,
	"display_phone_number" text,
	"verified_name" text,
	"quality_rating" text,
	"messaging_limit" text,
	"access_token_ciphertext" text,
	"token_key_version" text,
	"token_expires_at" timestamp with time zone,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_webhook_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"created_by" text,
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
	"applies_per_beneficiary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duty_roster_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"broker_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"question" text NOT NULL,
	"answer_type" text DEFAULT 'boolean' NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_checklist_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_carriers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"ans_code" text,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"description" text,
	"coverage" text,
	"ans_registration" text,
	"max_entry_age" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"archived_at" timestamp with time zone,
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
CREATE TABLE "imported_spreadsheets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"public_token" text,
	"public_password_hash" text,
	"public_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imported_spreadsheets_public_token_unique" UNIQUE("public_token")
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
CREATE TABLE "lead_assignment_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"broker_id" text NOT NULL,
	"sequence" integer DEFAULT 1 NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"first_contact_at" timestamp with time zone,
	"feedback_due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"expired_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_beneficiaries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"name" text NOT NULL,
	"birth_date" date NOT NULL,
	"relationship" "beneficiary_relationship" DEFAULT 'outro' NOT NULL,
	"is_holder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "lead_distribution_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"type" text DEFAULT 'process_queued_lead' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"idempotency_key" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"beneficiary_id" text,
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
CREATE TABLE "lead_feedbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"broker_id" text NOT NULL,
	"type" text NOT NULL,
	"content" text,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"checklist_id" text,
	"answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"distribution_origin" text,
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
	"source_channel" text DEFAULT 'landing_page' NOT NULL,
	"source_campaign" text,
	"source_ad" text,
	"source_form" text,
	"source_metadata" jsonb,
	"webhook_credential_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text,
	"provider" text NOT NULL,
	"platform" text NOT NULL,
	"external_account_id" text,
	"external_page_id" text,
	"external_form_id" text,
	"name" text NOT NULL,
	"status" "marketing_connection_status" DEFAULT 'inactive' NOT NULL,
	"access_token_ciphertext" text,
	"last_webhook_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_daily_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"metric_date" date NOT NULL,
	"campaign_id" text,
	"adset_id" text,
	"ad_id" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"external_event_id" text,
	"payload_hash" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'geral' NOT NULL,
	"content" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkey_credential_id_unique" UNIQUE("credential_id")
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
CREATE TABLE "post_sale_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"chargeback_window_days" integer DEFAULT 90 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"title" text NOT NULL,
	"description" text,
	"category" "promotional_material_category" DEFAULT 'materiais_divulgacao' NOT NULL,
	"image_url" text,
	"file_url" text,
	"target_branch" text,
	"target_carrier" text,
	"target_state" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "quote_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"beneficiary_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"calculated_value" numeric(12, 2) NOT NULL,
	"age_at_quote" integer NOT NULL,
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
	"lead_name" text,
	"lead_phone" text,
	"total_monthly" numeric(12, 2),
	"beneficiary_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "route_onboarding_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"route_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"completed_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"reset_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
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
	"policy_number" text,
	"coverage_start_date" date,
	"approved_value" numeric(12, 2),
	"confirmation_document_id" text,
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
CREATE TABLE "tenant_catalog_plan_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"global_plan_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_catalog_plan_settings_tenant_plan_unique" UNIQUE("tenant_id","global_plan_id")
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
CREATE TABLE "tenant_private_carriers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"ans_code" text,
	"contact" text,
	"phone" text,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_private_carriers_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "tenant_private_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"carrier_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"description" text,
	"coverage" text,
	"ans_registration" text,
	"max_entry_age" integer,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_private_price_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"table_version_id" text NOT NULL,
	"age_band" text NOT NULL,
	"min_age" integer,
	"max_age" integer,
	"monthly_price" numeric(12, 2) NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_private_price_rows_version_age_band_unique" UNIQUE("table_version_id","age_band")
);
--> statement-breakpoint
CREATE TABLE "tenant_private_price_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_private_table_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"price_table_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source_label" text,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_private_table_versions_table_number_unique" UNIQUE("price_table_id","version_number")
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
	"initial_setup_completed_at" timestamp with time zone,
	"subscription_plan" text DEFAULT 'Essencial' NOT NULL,
	"sla_first_contact_minutes" text DEFAULT '15' NOT NULL,
	"sla_stagnant_days" text DEFAULT '3' NOT NULL,
	"feedback_required_enabled" boolean DEFAULT true NOT NULL,
	"feedback_grace_minutes" text DEFAULT '5' NOT NULL,
	"auto_redistribute_on_feedback_timeout" boolean DEFAULT true NOT NULL,
	"feedback_reminder_interval_minutes" text DEFAULT '30' NOT NULL,
	"feedback_reminder_max_attempts" integer DEFAULT 5 NOT NULL,
	"feedback_push_enabled" boolean DEFAULT true NOT NULL,
	"feedback_toast_enabled" boolean DEFAULT true NOT NULL,
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
	"webhook_credential_id" text,
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
	"communication_channel_id" text,
	"provider" text DEFAULT 'openwa_legacy' NOT NULL,
	"message_id" text,
	"provider_status" text,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_customers" ADD CONSTRAINT "active_customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_catalog_plan_restrictions" ADD CONSTRAINT "branch_catalog_plan_restrictions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_catalog_plan_restrictions" ADD CONSTRAINT "branch_catalog_plan_restrictions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_catalog_plan_restrictions" ADD CONSTRAINT "branch_catalog_plan_restrictions_global_plan_id_global_plans_id_fk" FOREIGN KEY ("global_plan_id") REFERENCES "public"."global_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_catalog_plan_restrictions" ADD CONSTRAINT "branch_catalog_plan_restrictions_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plan_networks" ADD CONSTRAINT "carrier_plan_networks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plan_networks" ADD CONSTRAINT "carrier_plan_networks_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plan_prices" ADD CONSTRAINT "carrier_plan_prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plan_prices" ADD CONSTRAINT "carrier_plan_prices_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_plans" ADD CONSTRAINT "carrier_plans_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_audit_events" ADD CONSTRAINT "catalog_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_audit_events" ADD CONSTRAINT "catalog_audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_sets" ADD CONSTRAINT "catalog_change_sets_import_batch_id_catalog_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."catalog_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_sets" ADD CONSTRAINT "catalog_change_sets_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_sets" ADD CONSTRAINT "catalog_change_sets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_change_sets" ADD CONSTRAINT "catalog_change_sets_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_import_batches" ADD CONSTRAINT "catalog_import_batches_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_import_batches" ADD CONSTRAINT "catalog_import_batches_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price_rows" ADD CONSTRAINT "catalog_price_rows_table_version_id_catalog_table_versions_id_fk" FOREIGN KEY ("table_version_id") REFERENCES "public"."catalog_table_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price_tables" ADD CONSTRAINT "catalog_price_tables_plan_id_global_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."global_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price_tables" ADD CONSTRAINT "catalog_price_tables_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_table_versions" ADD CONSTRAINT "catalog_table_versions_price_table_id_catalog_price_tables_id_fk" FOREIGN KEY ("price_table_id") REFERENCES "public"."catalog_price_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_table_versions" ADD CONSTRAINT "catalog_table_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_corretor_id_user_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_schedule" ADD CONSTRAINT "commission_schedule_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channel_webhook_events" ADD CONSTRAINT "communication_channel_webhook_events_channel_id_communication_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_channels" ADD CONSTRAINT "communication_channels_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_schedule_id_unit_duty_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."unit_duty_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD CONSTRAINT "duty_roster_assignments_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_checklist_items" ADD CONSTRAINT "feedback_checklist_items_template_id_feedback_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."feedback_checklist_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_checklist_items" ADD CONSTRAINT "feedback_checklist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_checklist_templates" ADD CONSTRAINT "feedback_checklist_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_checklist_templates" ADD CONSTRAINT "feedback_checklist_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_carriers" ADD CONSTRAINT "global_carriers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_plans" ADD CONSTRAINT "global_plans_carrier_id_global_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."global_carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_plans" ADD CONSTRAINT "global_plans_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_spreadsheets" ADD CONSTRAINT "imported_spreadsheets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_spreadsheets" ADD CONSTRAINT "imported_spreadsheets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignment_attempts" ADD CONSTRAINT "lead_assignment_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignment_attempts" ADD CONSTRAINT "lead_assignment_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignment_attempts" ADD CONSTRAINT "lead_assignment_attempts_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_beneficiaries" ADD CONSTRAINT "lead_beneficiaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_beneficiaries" ADD CONSTRAINT "lead_beneficiaries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_events" ADD CONSTRAINT "lead_distribution_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_jobs" ADD CONSTRAINT "lead_distribution_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_jobs" ADD CONSTRAINT "lead_distribution_jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_queue_id_lead_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."lead_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_distribution_settings" ADD CONSTRAINT "lead_distribution_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_requirement_id_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."document_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_beneficiary_id_lead_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."lead_beneficiaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_documents" ADD CONSTRAINT "lead_documents_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedbacks" ADD CONSTRAINT "lead_feedbacks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedbacks" ADD CONSTRAINT "lead_feedbacks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedbacks" ADD CONSTRAINT "lead_feedbacks_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedbacks" ADD CONSTRAINT "lead_feedbacks_checklist_id_feedback_checklist_templates_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."feedback_checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queues" ADD CONSTRAINT "lead_queues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_queues" ADD CONSTRAINT "lead_queues_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_task_id_lead_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_webhook_credentials" ADD CONSTRAINT "lead_webhook_credentials_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_corretor_id_user_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_service_started_by_user_id_fk" FOREIGN KEY ("service_started_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_webhook_credential_id_lead_webhook_credentials_id_fk" FOREIGN KEY ("webhook_credential_id") REFERENCES "public"."lead_webhook_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connections" ADD CONSTRAINT "marketing_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connections" ADD CONSTRAINT "marketing_connections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_connections" ADD CONSTRAINT "marketing_connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_daily_metrics" ADD CONSTRAINT "marketing_daily_metrics_connection_id_marketing_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."marketing_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_webhook_events" ADD CONSTRAINT "marketing_webhook_events_connection_id_marketing_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."marketing_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sale_settings" ADD CONSTRAINT "post_sale_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sale_settings" ADD CONSTRAINT "post_sale_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_materials" ADD CONSTRAINT "promotional_materials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_materials" ADD CONSTRAINT "promotional_materials_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_beneficiary_id_lead_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."lead_beneficiaries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_onboarding_progress" ADD CONSTRAINT "route_onboarding_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_onboarding_progress" ADD CONSTRAINT "route_onboarding_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_broker_id_user_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_carrier_plan_id_carrier_plans_id_fk" FOREIGN KEY ("carrier_plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_commission_rule_id_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."commission_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_confirmation_document_id_lead_documents_id_fk" FOREIGN KEY ("confirmation_document_id") REFERENCES "public"."lead_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_catalog_plan_settings" ADD CONSTRAINT "tenant_catalog_plan_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_catalog_plan_settings" ADD CONSTRAINT "tenant_catalog_plan_settings_global_plan_id_global_plans_id_fk" FOREIGN KEY ("global_plan_id") REFERENCES "public"."global_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_catalog_plan_settings" ADD CONSTRAINT "tenant_catalog_plan_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_branch_tenant_fk" FOREIGN KEY ("branch_id","tenant_id") REFERENCES "public"."branches"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_carriers" ADD CONSTRAINT "tenant_private_carriers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_carriers" ADD CONSTRAINT "tenant_private_carriers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_plans" ADD CONSTRAINT "tenant_private_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_plans" ADD CONSTRAINT "tenant_private_plans_carrier_id_tenant_private_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."tenant_private_carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_plans" ADD CONSTRAINT "tenant_private_plans_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_price_rows" ADD CONSTRAINT "tenant_private_price_rows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_price_rows" ADD CONSTRAINT "tenant_private_price_rows_table_version_id_tenant_private_table_versions_id_fk" FOREIGN KEY ("table_version_id") REFERENCES "public"."tenant_private_table_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_price_tables" ADD CONSTRAINT "tenant_private_price_tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_price_tables" ADD CONSTRAINT "tenant_private_price_tables_plan_id_tenant_private_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."tenant_private_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_price_tables" ADD CONSTRAINT "tenant_private_price_tables_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_table_versions" ADD CONSTRAINT "tenant_private_table_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_table_versions" ADD CONSTRAINT "tenant_private_table_versions_price_table_id_tenant_private_price_tables_id_fk" FOREIGN KEY ("price_table_id") REFERENCES "public"."tenant_private_price_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_private_table_versions" ADD CONSTRAINT "tenant_private_table_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_queue_id_lead_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."lead_queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_webhook_credential_id_lead_webhook_credentials_id_fk" FOREIGN KEY ("webhook_credential_id") REFERENCES "public"."lead_webhook_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_duty_schedules" ADD CONSTRAINT "unit_duty_schedules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_credential_id_lead_webhook_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."lead_webhook_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_communication_channel_id_communication_channels_id_fk" FOREIGN KEY ("communication_channel_id") REFERENCES "public"."communication_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "active_customers_sale_unique" ON "active_customers" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "active_customers_tenant_status_idx" ON "active_customers" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "active_customers_branch_idx" ON "active_customers" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "branch_catalog_plan_restrictions_tenant_branch_idx" ON "branch_catalog_plan_restrictions" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE INDEX "branches_tenant_id_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_tenant_external_id_unique" ON "branches" USING btree ("tenant_id","external_id") WHERE "branches"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "carrier_plan_networks_plan_city_idx" ON "carrier_plan_networks" USING btree ("plan_id","city");--> statement-breakpoint
CREATE UNIQUE INDEX "carrier_plan_prices_plan_age_unique" ON "carrier_plan_prices" USING btree ("plan_id","age_band");--> statement-breakpoint
CREATE INDEX "carrier_plans_tenant_id_idx" ON "carrier_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "carrier_plans_carrier_id_idx" ON "carrier_plans" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carriers_tenant_id_idx" ON "carriers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carriers_tenant_name_unique" ON "carriers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "catalog_audit_events_tenant_created_idx" ON "catalog_audit_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "catalog_audit_events_actor_created_idx" ON "catalog_audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "catalog_change_sets_source_status_idx" ON "catalog_change_sets" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "catalog_change_sets_tenant_idx" ON "catalog_change_sets" USING btree ("target_tenant_id");--> statement-breakpoint
CREATE INDEX "catalog_import_batches_source_status_idx" ON "catalog_import_batches" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "catalog_import_batches_tenant_idx" ON "catalog_import_batches" USING btree ("target_tenant_id");--> statement-breakpoint
CREATE INDEX "catalog_price_rows_version_idx" ON "catalog_price_rows" USING btree ("table_version_id");--> statement-breakpoint
CREATE INDEX "catalog_price_tables_plan_status_idx" ON "catalog_price_tables" USING btree ("plan_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_price_tables_plan_code_unique" ON "catalog_price_tables" USING btree ("plan_id","code") WHERE "catalog_price_tables"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "catalog_table_versions_lookup_idx" ON "catalog_table_versions" USING btree ("price_table_id","status","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_lead_unique" ON "clients" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_corretor_idx" ON "clients" USING btree ("corretor_id");--> statement-breakpoint
CREATE INDEX "commission_rules_tenant_idx" ON "commission_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_rules_carrier_idx" ON "commission_rules" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "commission_rules_plan_idx" ON "commission_rules" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_tenant_idx" ON "commission_schedule" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_sale_idx" ON "commission_schedule" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "commission_schedule_ref_month_idx" ON "commission_schedule" USING btree ("reference_month");--> statement-breakpoint
CREATE INDEX "commission_schedule_status_idx" ON "commission_schedule" USING btree ("status");--> statement-breakpoint
CREATE INDEX "communication_channel_webhook_events_channel_idx" ON "communication_channel_webhook_events" USING btree ("channel_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_channel_webhook_events_provider_external_unique" ON "communication_channel_webhook_events" USING btree ("provider","external_event_id") WHERE "communication_channel_webhook_events"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "communication_channels_tenant_status_idx" ON "communication_channels" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "communication_channels_tenant_branch_idx" ON "communication_channels" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_channels_provider_phone_unique" ON "communication_channels" USING btree ("provider","phone_number_id") WHERE "communication_channels"."phone_number_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "document_requirements_tenant_idx" ON "document_requirements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "duty_roster_assignments_tenant_branch_idx" ON "duty_roster_assignments" USING btree ("tenant_id","branch_id","day_of_week","starts_at");--> statement-breakpoint
CREATE INDEX "duty_roster_assignments_broker_idx" ON "duty_roster_assignments" USING btree ("tenant_id","broker_id","day_of_week");--> statement-breakpoint
CREATE INDEX "duty_roster_assignments_schedule_idx" ON "duty_roster_assignments" USING btree ("schedule_id","status");--> statement-breakpoint
CREATE INDEX "feedback_checklist_items_template_idx" ON "feedback_checklist_items" USING btree ("template_id","sort_order");--> statement-breakpoint
CREATE INDEX "feedback_checklist_templates_tenant_idx" ON "feedback_checklist_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "global_carriers_name_unique" ON "global_carriers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "global_carriers_ans_code_unique" ON "global_carriers" USING btree ("ans_code") WHERE "global_carriers"."ans_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "global_carriers_status_idx" ON "global_carriers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "global_plans_carrier_status_idx" ON "global_plans" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "global_plans_carrier_code_unique" ON "global_plans" USING btree ("carrier_id","code") WHERE "global_plans"."code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_progress_goal_unique" ON "goal_progress" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goals_tenant_scope_idx" ON "goals" USING btree ("tenant_id","scope");--> statement-breakpoint
CREATE INDEX "goals_period_idx" ON "goals" USING btree ("tenant_id","period");--> statement-breakpoint
CREATE INDEX "imported_spreadsheets_tenant_idx" ON "imported_spreadsheets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "imported_spreadsheets_created_by_idx" ON "imported_spreadsheets" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "imported_spreadsheets_public_token_unique" ON "imported_spreadsheets" USING btree ("public_token") WHERE "imported_spreadsheets"."public_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "invites_user_id_idx" ON "invites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invites_token_hash_idx" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "lead_assignment_attempts_open_idx" ON "lead_assignment_attempts" USING btree ("tenant_id","status","feedback_due_at");--> statement-breakpoint
CREATE INDEX "lead_assignment_attempts_lead_idx" ON "lead_assignment_attempts" USING btree ("lead_id","sequence");--> statement-breakpoint
CREATE INDEX "lead_beneficiaries_tenant_lead_idx" ON "lead_beneficiaries" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_beneficiaries_lead_holder_idx" ON "lead_beneficiaries" USING btree ("lead_id","is_holder");--> statement-breakpoint
CREATE INDEX "lead_distribution_events_tenant_lead_idx" ON "lead_distribution_events" USING btree ("tenant_id","lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_distribution_jobs_due_idx" ON "lead_distribution_jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "lead_distribution_jobs_tenant_created_idx" ON "lead_distribution_jobs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_distribution_jobs_active_unique" ON "lead_distribution_jobs" USING btree ("tenant_id","lead_id","type") WHERE "lead_distribution_jobs"."status" in ('pending', 'retrying', 'processing');--> statement-breakpoint
CREATE INDEX "lead_distribution_settings_tenant_idx" ON "lead_distribution_settings" USING btree ("tenant_id","branch_id","queue_id");--> statement-breakpoint
CREATE INDEX "lead_documents_tenant_lead_idx" ON "lead_documents" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_feedbacks_lead_created_idx" ON "lead_feedbacks" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_interactions_lead_created_idx" ON "lead_interactions" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_queues_tenant_branch_idx" ON "lead_queues" USING btree ("tenant_id","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_queues_tenant_branch_slug_unique" ON "lead_queues" USING btree ("tenant_id","branch_id","slug");--> statement-breakpoint
CREATE INDEX "lead_task_assignees_tenant_user_idx" ON "lead_task_assignees" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "lead_tasks_tenant_lead_idx" ON "lead_tasks" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_tasks_assigned_due_idx" ON "lead_tasks" USING btree ("assigned_to","due_at");--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_tenant_id_idx" ON "lead_webhook_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_branch_id_idx" ON "lead_webhook_credentials" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "lead_webhook_credentials_created_by_idx" ON "lead_webhook_credentials" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "leads_tenant_branch_status_idx" ON "leads" USING btree ("tenant_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "leads_tenant_distribution_status_idx" ON "leads" USING btree ("tenant_id","distribution_status");--> statement-breakpoint
CREATE INDEX "leads_branch_queue_distribution_idx" ON "leads" USING btree ("branch_id","queue_id","distribution_status");--> statement-breakpoint
CREATE INDEX "leads_corretor_status_idx" ON "leads" USING btree ("corretor_id","status");--> statement-breakpoint
CREATE INDEX "leads_webhook_credential_idx" ON "leads" USING btree ("webhook_credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_credential_external_id_unique" ON "leads" USING btree ("webhook_credential_id","external_id") WHERE "leads"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_tenant_source_external_id_unique" ON "leads" USING btree ("tenant_id","source_channel","external_id") WHERE "leads"."external_id" IS NOT NULL AND "leads"."source_channel" <> 'landing_page';--> statement-breakpoint
CREATE INDEX "marketing_connections_tenant_idx" ON "marketing_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "marketing_connections_page_idx" ON "marketing_connections" USING btree ("external_page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_connections_tenant_platform_account_unique" ON "marketing_connections" USING btree ("tenant_id","platform","external_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_daily_metrics_unique" ON "marketing_daily_metrics" USING btree ("connection_id","metric_date","campaign_id","adset_id","ad_id");--> statement-breakpoint
CREATE INDEX "marketing_webhook_events_connection_idx" ON "marketing_webhook_events" USING btree ("connection_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_webhook_events_provider_external_unique" ON "marketing_webhook_events" USING btree ("provider","external_event_id") WHERE "marketing_webhook_events"."external_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "message_templates_tenant_idx" ON "message_templates" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credential_id_unique" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "platform_audit_logs_actor_idx" ON "platform_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_sale_settings_tenant_unique" ON "post_sale_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "promo_materials_tenant_idx" ON "promotional_materials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "promo_materials_category_idx" ON "promotional_materials" USING btree ("category");--> statement-breakpoint
CREATE INDEX "promo_materials_active_idx" ON "promotional_materials" USING btree ("active");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_tenant_idx" ON "push_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_line_items_tenant_quote_idx" ON "quote_line_items" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_line_items_quote_beneficiary_plan_unique" ON "quote_line_items" USING btree ("quote_id","beneficiary_id","plan_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_lead_idx" ON "quotes" USING btree ("tenant_id","lead_id");--> statement-breakpoint
CREATE INDEX "quotes_public_token_idx" ON "quotes" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "route_onboarding_progress_user_route_unique" ON "route_onboarding_progress" USING btree ("tenant_id","user_id","route_key");--> statement-breakpoint
CREATE INDEX "route_onboarding_progress_user_idx" ON "route_onboarding_progress" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_idx" ON "sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_lead_idx" ON "sales" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "sales_broker_idx" ON "sales" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_catalog_plan_settings_tenant_enabled_idx" ON "tenant_catalog_plan_settings" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "tenant_memberships_tenant_id_idx" ON "tenant_memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_memberships_branch_id_idx" ON "tenant_memberships" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "tenant_private_carriers_tenant_active_idx" ON "tenant_private_carriers" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "tenant_private_plans_tenant_carrier_active_idx" ON "tenant_private_plans" USING btree ("tenant_id","carrier_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_private_plans_carrier_code_unique" ON "tenant_private_plans" USING btree ("carrier_id","code") WHERE "tenant_private_plans"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tenant_private_price_rows_tenant_version_idx" ON "tenant_private_price_rows" USING btree ("tenant_id","table_version_id");--> statement-breakpoint
CREATE INDEX "tenant_private_price_tables_tenant_plan_idx" ON "tenant_private_price_tables" USING btree ("tenant_id","plan_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_private_price_tables_plan_code_unique" ON "tenant_private_price_tables" USING btree ("plan_id","code") WHERE "tenant_private_price_tables"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tenant_private_table_versions_lookup_idx" ON "tenant_private_table_versions" USING btree ("tenant_id","price_table_id","status","effective_from");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "twoFactor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "unit_duty_schedules_tenant_status_idx" ON "unit_duty_schedules" USING btree ("tenant_id","status","day_of_week","starts_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_tenant_id_idx" ON "webhook_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_credential_id_idx" ON "webhook_deliveries" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_credential_idempotency_unique" ON "webhook_deliveries" USING btree ("credential_id","idempotency_key") WHERE "webhook_deliveries"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_connections_user_idx" ON "whatsapp_connections" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_connections_session_idx" ON "whatsapp_connections" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_tenant_user_unique" ON "whatsapp_connections" USING btree ("tenant_id","user_id") WHERE "whatsapp_connections"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_tenant_lead_idx" ON "whatsapp_messages" USING btree ("tenant_id","lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_message_unique" ON "whatsapp_messages" USING btree ("tenant_id","message_id");