-- Plantão (2026-10-13): corretor convidado, ainda sem conta, já escalado num plantão.
-- Tabela nova e vazia: não toca em nenhuma tabela existente.
CREATE TABLE IF NOT EXISTS "duty_roster_pending" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "schedule_id" text NOT NULL REFERENCES "unit_duty_schedules"("id") ON DELETE cascade,
  "broker_profile_id" text NOT NULL REFERENCES "broker_profiles"("id") ON DELETE cascade,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "duty_roster_pending_schedule_profile_unique" ON "duty_roster_pending" ("schedule_id", "broker_profile_id");
CREATE INDEX IF NOT EXISTS "duty_roster_pending_profile_idx" ON "duty_roster_pending" ("tenant_id", "broker_profile_id");
