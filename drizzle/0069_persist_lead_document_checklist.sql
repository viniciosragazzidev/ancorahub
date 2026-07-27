CREATE TABLE IF NOT EXISTS "lead_document_checklist" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "requirement_id" text NOT NULL REFERENCES "document_requirements"("id") ON DELETE CASCADE,
  "beneficiary_id" text REFERENCES "lead_beneficiaries"("id") ON DELETE CASCADE,
  "document_id" text REFERENCES "lead_documents"("id") ON DELETE SET NULL,
  "scope_key" text NOT NULL,
  "status" "document_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_document_checklist_scope_unique" ON "lead_document_checklist" ("scope_key");
CREATE INDEX IF NOT EXISTS "lead_document_checklist_tenant_lead_idx" ON "lead_document_checklist" ("tenant_id", "lead_id");
CREATE INDEX IF NOT EXISTS "lead_document_checklist_beneficiary_idx" ON "lead_document_checklist" ("tenant_id", "beneficiary_id");
