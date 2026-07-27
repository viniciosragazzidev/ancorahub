ALTER TABLE "ai_conversations"
  ADD COLUMN IF NOT EXISTS "automation_state" text NOT NULL DEFAULT 'AI_ACTIVE',
  ADD COLUMN IF NOT EXISTS "quick_reply_last_template" text,
  ADD COLUMN IF NOT EXISTS "quick_reply_last_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "quick_reply_wait_window_started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "quick_reply_wait_response_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "opt_out_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "wrong_number_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_quick_reply_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "rule_key" text NOT NULL,
  "template_key" text NOT NULL,
  "body" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "updated_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_quick_reply_templates_tenant_rule_unique" ON "ai_quick_reply_templates" ("tenant_id", "rule_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_quick_reply_templates_tenant_active_idx" ON "ai_quick_reply_templates" ("tenant_id", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_quick_reply_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "conversation_id" text REFERENCES "ai_conversations"("id") ON DELETE cascade,
  "lead_id" text REFERENCES "leads"("id") ON DELETE cascade,
  "source_message_id" text,
  "intent" text NOT NULL,
  "rule_key" text NOT NULL,
  "template_key" text,
  "outcome" text NOT NULL,
  "estimated_tokens_saved" integer NOT NULL DEFAULT 0,
  "notified_user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_quick_reply_events_tenant_created_idx" ON "ai_quick_reply_events" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_quick_reply_events_conversation_idx" ON "ai_quick_reply_events" ("conversation_id", "created_at");
