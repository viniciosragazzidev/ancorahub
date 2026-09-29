-- Attendance situations (Atendimento → Situações): per tenant, the phrases it
-- taught for the system's situations (and whether an optional one is on) and
-- its own situations with a fixed reply and action. Texts of the system's
-- replies stay in ai_quick_reply_templates; nothing is migrated.
CREATE TABLE IF NOT EXISTS attendance_situations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  situation_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('builtin', 'custom')),
  title text,
  example_phrases jsonb NOT NULL DEFAULT '[]'::jsonb,
  response text,
  action text CHECK (action IN ('continue', 'transfer')),
  enabled boolean NOT NULL DEFAULT true,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS attendance_situations_tenant_key_unique
  ON attendance_situations (tenant_id, situation_key);
