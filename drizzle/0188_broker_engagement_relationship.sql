-- 0188: Central de relacionamento (R1) e base da jornada do corretor (R0).
-- Plan: docs/implementations/active/2026-10-10-central-relacionamento-corretor.md
-- New tables only, plus collector indexes on existing tables. In production the
-- indexes on existing tables are built CONCURRENTLY by
-- scripts/apply-0188-engagement-relationship.mjs before this file runs.

CREATE TABLE IF NOT EXISTS "engagement_point_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "rule_key" text NOT NULL,
  "points" integer NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "lead_id" text REFERENCES "leads"("id") ON DELETE SET NULL,
  "idempotency_key" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "period_day" date NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "reversed_at" timestamp with time zone,
  "reversal_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_point_events_tenant_key_unique" ON "engagement_point_events" ("tenant_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_point_events_tenant_broker_occurred_idx" ON "engagement_point_events" ("tenant_id", "broker_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_point_events_tenant_day_idx" ON "engagement_point_events" ("tenant_id", "period_day", "rule_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_watermarks" (
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "last_run_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenant_id", "source")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_settings" (
  "tenant_id" text PRIMARY KEY NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_broadcasts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sender_id" text NOT NULL REFERENCES "user"("id"),
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "audience" jsonb NOT NULL,
  "audience_label" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'app',
  "require_ack" boolean NOT NULL DEFAULT false,
  "recipients_count" integer NOT NULL DEFAULT 0,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "relationship_broadcasts_kind_check" CHECK ("kind" IN ('notice', 'recognition', 'confirmation')),
  CONSTRAINT "relationship_broadcasts_channel_check" CHECK ("channel" IN ('app', 'app_whatsapp'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationship_broadcasts_tenant_created_idx" ON "relationship_broadcasts" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_broadcast_recipients" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broadcast_id" text NOT NULL REFERENCES "relationship_broadcasts"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "notification_key" text NOT NULL,
  "delivered_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "ack_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_recipients_broadcast_broker_unique" ON "relationship_broadcast_recipients" ("broadcast_id", "broker_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationship_recipients_tenant_broker_idx" ON "relationship_broadcast_recipients" ("tenant_id", "broker_id", "created_at");
--> statement-breakpoint
-- Collector indexes on existing tables (built CONCURRENTLY in production by the script).
CREATE INDEX IF NOT EXISTS "lead_offers_tenant_offered_at_idx" ON "lead_offers" ("tenant_id", "offered_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_offers_tenant_accepted_at_partial_idx" ON "lead_offers" ("tenant_id", "accepted_at") WHERE "accepted_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_tasks_tenant_completed_at_partial_idx" ON "lead_tasks" ("tenant_id", "completed_at") WHERE "completed_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_interactions_note_created_idx" ON "lead_interactions" ("created_at") WHERE "tipo" = 'note';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_presence_tenant_confirmed_at_partial_idx" ON "duty_presence_confirmations" ("tenant_id", "confirmed_at") WHERE "confirmed_at" IS NOT NULL;
