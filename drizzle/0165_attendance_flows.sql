-- Attendance flows per queue (DEC-127, 2026-09-27). Additive: nothing runs
-- until the global switch feature_attendance_flows_enabled is on AND a queue
-- points at a flow. A queue without a flow keeps today's intake.
CREATE TABLE IF NOT EXISTS attendance_flows (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  builtin_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  published_version_id text,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS attendance_flows_builtin_unique ON attendance_flows (tenant_id, builtin_key) WHERE builtin_key IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS attendance_flow_versions (
  id text PRIMARY KEY,
  flow_id text NOT NULL REFERENCES attendance_flows(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded')),
  definition jsonb NOT NULL,
  published_at timestamptz,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, version)
);
--> statement-breakpoint
-- One execution per lead at a time: an open run owns the lead's attendance.
CREATE TABLE IF NOT EXISTS attendance_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  flow_version_id text NOT NULL REFERENCES attendance_flow_versions(id),
  queue_id text,
  status text NOT NULL CHECK (status IN ('running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_node_id text,
  waiting_for text,
  wake_at timestamptz,
  last_reply text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS attendance_runs_one_open_per_lead ON attendance_runs (tenant_id, lead_id) WHERE status IN ('running', 'waiting');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_runs_wake_idx ON attendance_runs (wake_at) WHERE status = 'waiting';
--> statement-breakpoint
-- Every block a run went through, once: the idempotency key makes a retry safe.
CREATE TABLE IF NOT EXISTS attendance_run_steps (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES attendance_runs(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('done', 'failed')),
  idempotency_key text NOT NULL UNIQUE,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE lead_queues ADD COLUMN IF NOT EXISTS attendance_flow_id text REFERENCES attendance_flows(id) ON DELETE SET NULL;
