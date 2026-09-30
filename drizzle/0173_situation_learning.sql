-- Learning of new attendance situations (Atendimento → Situações).
-- situation_learning_events: every question asked in the middle of the
-- qualification, with the situation that covered it (null = none did), the
-- AI's answer and, later, the broker's answer after a transfer. Personal data
-- is removed before saving; rows are deleted after 90 days.
-- situation_suggestions: situations the AI proposes from the questions no
-- situation covered, reviewed by a director (or activated automatically when
-- the tenant turns that on). attendance_situations.origin tells a situation
-- created by hand from one approved or activated from a suggestion.
CREATE TABLE IF NOT EXISTS situation_learning_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id text,
  lead_id text REFERENCES leads(id) ON DELETE SET NULL,
  question text NOT NULL,
  normalized_question text NOT NULL,
  matched_situation_key text,
  ai_answer text,
  broker_answer text,
  broker_answered_at timestamptz,
  channel text,
  communication_channel_id text,
  suggestion_id text,
  clustered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS situation_learning_events_tenant_created_idx
  ON situation_learning_events (tenant_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS situation_learning_events_uncovered_idx
  ON situation_learning_events (tenant_id, clustered_at)
  WHERE matched_situation_key IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS situation_suggestions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'merged', 'dismissed', 'auto_activated')),
  kind text NOT NULL CHECK (kind IN ('new', 'merge')),
  target_situation_key text,
  title text NOT NULL,
  phrases jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  action text NOT NULL DEFAULT 'continue' CHECK (action IN ('continue', 'transfer')),
  occurrences integer NOT NULL DEFAULT 0,
  examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_asked_at timestamptz,
  last_asked_at timestamptz,
  from_broker boolean NOT NULL DEFAULT false,
  model_used text,
  resolved_situation_key text,
  resolved_by text REFERENCES "user"(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS situation_suggestions_tenant_status_idx
  ON situation_suggestions (tenant_id, status);
--> statement-breakpoint
ALTER TABLE attendance_situations ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';
