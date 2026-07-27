CREATE TABLE IF NOT EXISTS "lead_distribution_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 8,
  "run_after" timestamp with time zone NOT NULL DEFAULT now(),
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "lease_expires_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_message" text,
  "idempotency_key" text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_distribution_jobs_due_idx"
  ON "lead_distribution_jobs" ("status", "run_after");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_distribution_jobs_tenant_created_idx"
  ON "lead_distribution_jobs" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_distribution_jobs_active_unique"
  ON "lead_distribution_jobs" ("tenant_id", "lead_id", "type")
  WHERE "status" IN ('pending', 'retrying', 'processing');
