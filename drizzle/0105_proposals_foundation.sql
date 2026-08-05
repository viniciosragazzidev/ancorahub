DO $$ BEGIN
  CREATE TYPE "proposal_status" AS ENUM ('rascunho', 'em_revisao', 'enviada', 'visualizada', 'negociacao', 'aprovada', 'perdida', 'expirada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "proposals" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "quote_id" text REFERENCES "quotes"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "status" "proposal_status" DEFAULT 'rascunho' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "valid_until" timestamptz NOT NULL,
  "notes" text,
  "document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "converted_at" timestamptz,
  "converted_sale_id" text REFERENCES "sales"("id") ON DELETE SET NULL,
  "total_monthly" numeric(12, 2) DEFAULT '0' NOT NULL,
  "beneficiary_count" integer DEFAULT 0 NOT NULL,
  "lead_name" text NOT NULL,
  "lead_phone" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "proposals_tenant_lead_idx" ON "proposals" ("tenant_id", "lead_id");
CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "proposals" ("status");
