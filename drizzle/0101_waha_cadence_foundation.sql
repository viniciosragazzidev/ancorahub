-- WAHA is a platform relay. These records never store the VPS API secret or a raw
-- recipient phone; recipient addresses remain in the existing CRM records.
CREATE TABLE IF NOT EXISTS "waha_numbers" (
  "id" text PRIMARY KEY NOT NULL,
  "relay_session_id" text NOT NULL,
  "display_phone_number" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "max_messages_per_hour" integer NOT NULL DEFAULT 60,
  "min_interval_seconds" integer NOT NULL DEFAULT 45,
  "last_health_at" timestamptz,
  "last_error_code" text,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_numbers_relay_session_unique" ON "waha_numbers" ("relay_session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_numbers_display_phone_unique" ON "waha_numbers" ("display_phone_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_numbers_status_idx" ON "waha_numbers" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_cadences" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "active_version_id" text,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "paused_at" timestamptz,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_cadences_tenant_status_idx" ON "waha_cadences" ("tenant_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_cadence_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "cadence_id" text NOT NULL REFERENCES "waha_cadences"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "waha_number_id" text REFERENCES "waha_numbers"("id") ON DELETE RESTRICT,
  "definition" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "published_at" timestamptz,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_cadence_versions_unique" ON "waha_cadence_versions" ("cadence_id", "version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_cadence_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "cadence_id" text NOT NULL REFERENCES "waha_cadences"("id") ON DELETE CASCADE,
  "version_id" text NOT NULL REFERENCES "waha_cadence_versions"("id") ON DELETE RESTRICT,
  "waha_number_id" text NOT NULL REFERENCES "waha_numbers"("id") ON DELETE RESTRICT,
  "recipient_type" text NOT NULL,
  "recipient_id" text NOT NULL,
  "contact_phone_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "current_step" integer NOT NULL DEFAULT 0,
  "next_action_at" timestamptz,
  "inbound_at" timestamptz,
  "paused_at" timestamptz,
  "ended_at" timestamptz,
  "last_error_code" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_cadence_runs_version_recipient_unique" ON "waha_cadence_runs" ("version_id", "recipient_type", "recipient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_cadence_runs_tenant_status_due_idx" ON "waha_cadence_runs" ("tenant_id", "status", "next_action_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_cadence_runs_phone_hash_idx" ON "waha_cadence_runs" ("contact_phone_hash", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_delivery_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "run_id" text NOT NULL REFERENCES "waha_cadence_runs"("id") ON DELETE CASCADE,
  "waha_number_id" text NOT NULL REFERENCES "waha_numbers"("id") ON DELETE RESTRICT,
  "step_index" integer NOT NULL,
  "kind" text NOT NULL DEFAULT 'cadence',
  "message_body" text,
  "idempotency_key" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "run_after" timestamptz NOT NULL DEFAULT now(),
  "provider_message_id" text,
  "locked_at" timestamptz,
  "locked_by" text,
  "lease_expires_at" timestamptz,
  "last_error_code" text,
  "completed_at" timestamptz,
  "failed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_delivery_outbox_tenant_idempotency_unique" ON "waha_delivery_outbox" ("tenant_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_delivery_outbox_due_idx" ON "waha_delivery_outbox" ("status", "run_after");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_suppressions" (
  "id" text PRIMARY KEY NOT NULL,
  "phone_hash" text NOT NULL,
  "reason" text NOT NULL,
  "source" text NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_suppressions_phone_unique" ON "waha_suppressions" ("phone_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waha_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "external_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'received',
  "error_code" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_webhook_events_external_unique" ON "waha_webhook_events" ("external_event_id");
--> statement-breakpoint
INSERT INTO "system_settings" ("key", "value") VALUES
  ('feature_waha_cadence_enabled', 'false'),
  ('feature_waha_ai_enabled', 'false'),
  ('feature_ai_tool_registry_enabled', 'false'),
  ('feature_knowledge_retrieval_enabled', 'false'),
  ('feature_external_mcp_enabled', 'false'),
  ('waha_cadence_max_attempts', '5'),
  ('waha_cadence_retry_base_seconds', '60'),
  ('waha_cadence_lease_seconds', '120')
ON CONFLICT ("key") DO NOTHING;
