CREATE TABLE IF NOT EXISTS "supervisor_transfer_requests" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "from_supervisor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "to_supervisor_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "decided_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "decided_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "supervisor_transfer_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT "supervisor_transfer_requests_reason_length_check" CHECK (char_length(trim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "supervisor_transfer_requests_branch_tenant_fk" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_transfer_requests_one_pending_broker_idx"
  ON "supervisor_transfer_requests" ("tenant_id", "broker_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supervisor_transfer_requests_tenant_branch_status_idx"
  ON "supervisor_transfer_requests" ("tenant_id", "branch_id", "status", "created_at" DESC);
