CREATE TYPE "automation_status" AS ENUM('rascunho', 'teste', 'publicado', 'pausado', 'encerrado');
CREATE TYPE "automation_log_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'dead_letter');

CREATE TABLE IF NOT EXISTS "crm_automations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "trigger_type" text NOT NULL,
  "status" "automation_status" DEFAULT 'rascunho' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "description" text,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "template_body" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "crm_automation_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "automation_id" text NOT NULL REFERENCES "crm_automations"("id") ON DELETE cascade,
  "lead_id" text REFERENCES "leads"("id") ON DELETE cascade,
  "client_id" text REFERENCES "clients"("id") ON DELETE cascade,
  "status" "automation_log_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "last_error" text,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "whatsapp_flows" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "trigger_type" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "crm_automations_tenant_idx" ON "crm_automations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "crm_automation_logs_run_idx" ON "crm_automation_logs" ("status", "run_after");
CREATE INDEX IF NOT EXISTS "whatsapp_flows_tenant_idx" ON "whatsapp_flows" ("tenant_id");
