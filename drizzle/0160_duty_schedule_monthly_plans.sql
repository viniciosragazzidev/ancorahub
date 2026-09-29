CREATE TABLE IF NOT EXISTS duty_schedule_monthly_plans (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  quotas jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurrences jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NOT NULL REFERENCES "user"(id),
  published_by text REFERENCES "user"(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, month_key, revision)
);

CREATE INDEX IF NOT EXISTS duty_schedule_monthly_plans_tenant_month_status_idx
  ON duty_schedule_monthly_plans (tenant_id, month_key, status);
