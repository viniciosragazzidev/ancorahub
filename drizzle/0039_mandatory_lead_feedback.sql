ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_required_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_grace_minutes" text NOT NULL DEFAULT '5';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "auto_redistribute_on_feedback_timeout" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_feedbacks" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "broker_id" text NOT NULL REFERENCES "user"("id"),
  "type" text NOT NULL,
  "content" text,
  "next_action" text,
  "next_action_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_feedbacks_lead_created_idx" ON "lead_feedbacks" USING btree ("lead_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_assignment_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "broker_id" text NOT NULL REFERENCES "user"("id"),
  "sequence" integer DEFAULT 1 NOT NULL,
  "assigned_at" timestamp with time zone NOT NULL,
  "first_contact_at" timestamp with time zone,
  "feedback_due_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "expired_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "release_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_assignment_attempts_open_idx" ON "lead_assignment_attempts" USING btree ("tenant_id", "status", "feedback_due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_assignment_attempts_lead_idx" ON "lead_assignment_attempts" USING btree ("lead_id", "sequence");
