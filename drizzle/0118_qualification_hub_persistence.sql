CREATE TABLE IF NOT EXISTS "ai_qualification_followup_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "trigger" text NOT NULL,
  "delay_minutes" integer NOT NULL DEFAULT 120,
  "max_attempts" integer NOT NULL DEFAULT 3,
  "minimum_interval_minutes" integer NOT NULL DEFAULT 60,
  "allowed_days" jsonb NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  "allowed_start_time" text NOT NULL DEFAULT '08:00',
  "allowed_end_time" text NOT NULL DEFAULT '18:00',
  "timezone" text NOT NULL DEFAULT 'America/Sao_Paulo',
  "message_mode" text NOT NULL DEFAULT 'fixed',
  "fixed_message" text,
  "template_id" text,
  "stop_conditions" jsonb NOT NULL DEFAULT '["client_responded","human_taken","lead_closed","sale_completed","opt_out"]'::jsonb,
  "destination_status" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_qualification_followup_tenant_idx" ON "ai_qualification_followup_rules" ("tenant_id", "enabled");

CREATE TABLE IF NOT EXISTS "ai_qualification_tool_permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tool_name" text NOT NULL,
  "category" text NOT NULL,
  "permission" text NOT NULL DEFAULT 'allowed',
  "allowed_stage_transitions" jsonb,
  "max_calls_per_session" integer NOT NULL DEFAULT 10,
  "requires_human_confirmation" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_qualification_tool_perm_unique" ON "ai_qualification_tool_permissions" ("tenant_id", "tool_name");

CREATE TABLE IF NOT EXISTS "ai_qualification_destination_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "temperature_class" text NOT NULL,
  "destination_type" text NOT NULL,
  "destination_target_id" text,
  "priority" text NOT NULL DEFAULT 'normal',
  "sla_minutes" integer NOT NULL DEFAULT 15,
  "fallback_destination_type" text NOT NULL DEFAULT 'manager',
  "criteria_conditions" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_qualification_dest_tenant_idx" ON "ai_qualification_destination_rules" ("tenant_id", "temperature_class");

CREATE TABLE IF NOT EXISTS "broker_eligibility_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "allowed_lead_types" jsonb NOT NULL DEFAULT '["hot","warm","cold"]'::jsonb,
  "specialties" jsonb NOT NULL DEFAULT '["individual","familiar","empresarial","pme"]'::jsonb,
  "operators" jsonb NOT NULL DEFAULT '["unimed","hapvida"]'::jsonb,
  "max_simultaneous_capacity" integer NOT NULL DEFAULT 15,
  "daily_limit" integer NOT NULL DEFAULT 40,
  "participates_in_duty" boolean NOT NULL DEFAULT true,
  "receives_off_hours" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "paused" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "broker_eligibility_tenant_user_unique" ON "broker_eligibility_profiles" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "ai_qualification_closing_states" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL,
  "lead_id" text,
  "qualification_completed_at" timestamp with time zone,
  "closing_message_queued_at" timestamp with time zone,
  "closing_message_sent_at" timestamp with time zone,
  "closing_message_id" text,
  "closing_message_status" text NOT NULL DEFAULT 'pending',
  "distribution_executed_at" timestamp with time zone,
  "handoff_created_at" timestamp with time zone,
  "post_closing_notice_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_qualification_closing_session_unique" ON "ai_qualification_closing_states" ("tenant_id", "session_id");

CREATE TABLE IF NOT EXISTS "ai_qualification_system_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "message_text" text NOT NULL,
  "template_id" text,
  "variables" jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_qualification_sysmsg_tenant_cat_unique" ON "ai_qualification_system_messages" ("tenant_id", "category");

CREATE TABLE IF NOT EXISTS "ai_qualification_alerts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "alert_type" text NOT NULL,
  "level" text NOT NULL DEFAULT 'warning',
  "status" text NOT NULL DEFAULT 'active',
  "message" text NOT NULL,
  "suggested_action" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" text
);
CREATE INDEX IF NOT EXISTS "ai_qualification_alerts_tenant_idx" ON "ai_qualification_alerts" ("tenant_id", "status");
