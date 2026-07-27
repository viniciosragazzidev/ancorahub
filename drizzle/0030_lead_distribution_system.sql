ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_status" text NOT NULL DEFAULT 'unassigned';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "queue_id" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "unit_assigned_at" timestamptz;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignment_source" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignment_strategy" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "distribution_updated_at" timestamptz;
CREATE INDEX IF NOT EXISTS "leads_tenant_distribution_status_idx" ON "leads" ("tenant_id", "distribution_status");
CREATE INDEX IF NOT EXISTS "leads_branch_queue_distribution_idx" ON "leads" ("branch_id", "queue_id", "distribution_status");

CREATE TABLE IF NOT EXISTS "lead_queues" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "assignment_mode" text NOT NULL DEFAULT 'automatic',
  "assignment_strategy" text NOT NULL DEFAULT 'capacity',
  "capacity_enabled" boolean NOT NULL DEFAULT false,
  "capacity_per_broker" integer,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "lead_queues_tenant_branch_idx" ON "lead_queues" ("tenant_id", "branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lead_queues_tenant_branch_slug_unique" ON "lead_queues" ("tenant_id", "branch_id", "slug");

CREATE TABLE IF NOT EXISTS "lead_distribution_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
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
  "actor_id" text NOT NULL REFERENCES "user"("id"),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_distribution_events_tenant_lead_idx" ON "lead_distribution_events" ("tenant_id", "lead_id", "created_at");

CREATE TABLE IF NOT EXISTS "lead_distribution_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE CASCADE,
  "queue_id" text REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "automatic_routing_enabled" boolean NOT NULL DEFAULT true,
  "automatic_assignment_enabled" boolean NOT NULL DEFAULT true,
  "default_queue_id" text,
  "fallback_queue_id" text,
  "allow_manager_manual_assignment" boolean NOT NULL DEFAULT true,
  "allow_director_manual_assignment" boolean NOT NULL DEFAULT true,
  "duty_schedule_enabled" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "updated_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_distribution_settings_tenant_idx" ON "lead_distribution_settings" ("tenant_id", "branch_id", "queue_id");

CREATE TABLE IF NOT EXISTS "unit_duty_schedules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "queue_id" text NOT NULL REFERENCES "lead_queues"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "day_of_week" integer NOT NULL,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 100,
  "status" text NOT NULL DEFAULT 'active',
  "timezone" text NOT NULL DEFAULT 'America/Sao_Paulo',
  "valid_from" timestamptz NOT NULL,
  "valid_until" timestamptz,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "unit_duty_schedules_tenant_status_idx" ON "unit_duty_schedules" ("tenant_id", "status", "day_of_week", "starts_at");
