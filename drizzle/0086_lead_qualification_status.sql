ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "qualification_status" text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_qualification_status_idx"
  ON "leads" ("tenant_id", "qualification_status");
