CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text REFERENCES "leads"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "clients"("id") ON DELETE CASCADE,
  "communication_channel_id" text REFERENCES "communication_channels"("id") ON DELETE SET NULL,
  "assigned_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'NEW',
  "ai_model" text DEFAULT 'openrouter/auto',
  "qualification_summary" text,
  "transfer_reason" text,
  "paused_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "lock_version" integer NOT NULL DEFAULT 1,
  "language" text NOT NULL DEFAULT 'pt-BR',
  "last_processed_message_id" text,
  "memory" jsonb,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_activity_at" timestamp with time zone NOT NULL DEFAULT now(),
  "transferred_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_status_idx" ON "ai_conversations" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_lead_idx" ON "ai_conversations" ("tenant_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_assigned_user_idx" ON "ai_conversations" ("assigned_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_attendance_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "conversation_id" text REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "lead_id" text REFERENCES "leads"("id") ON DELETE CASCADE,
  "provider" text NOT NULL DEFAULT 'openrouter',
  "model_used" text NOT NULL,
  "prompt_tokens" integer DEFAULT 0,
  "completion_tokens" integer DEFAULT 0,
  "total_tokens" integer DEFAULT 0,
  "estimated_cost" text DEFAULT '0',
  "latency_ms" integer DEFAULT 0,
  "status" text NOT NULL DEFAULT 'success',
  "error_message" text,
  "source_message_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_attendance_logs_tenant_conv_idx" ON "ai_attendance_logs" ("tenant_id", "conversation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_attendance_logs_source_message_unique" ON "ai_attendance_logs" ("tenant_id", "conversation_id", "source_message_id") WHERE "source_message_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "conversation_id" text;
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN IF NOT EXISTS "sender_role" text DEFAULT 'user';
