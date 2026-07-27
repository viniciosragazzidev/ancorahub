DO $$ BEGIN
  CREATE TYPE "beneficiary_relationship" AS ENUM ('titular', 'conjuge', 'filho', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "active_customer_status" AS ENUM ('active', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "beneficiary_relationship" ADD VALUE IF NOT EXISTS 'titular';
  ALTER TYPE "beneficiary_relationship" ADD VALUE IF NOT EXISTS 'conjuge';
  ALTER TYPE "beneficiary_relationship" ADD VALUE IF NOT EXISTS 'filho';
  ALTER TYPE "beneficiary_relationship" ADD VALUE IF NOT EXISTS 'outro';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "commission_schedule_status" ADD VALUE IF NOT EXISTS 'chargeback_pending';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "lead_beneficiaries" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "birth_date" date NOT NULL,
  "relationship" "beneficiary_relationship" DEFAULT 'outro' NOT NULL,
  "is_holder" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_beneficiaries_tenant_lead_idx" ON "lead_beneficiaries" ("tenant_id", "lead_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lead_beneficiaries_one_holder_idx" ON "lead_beneficiaries" ("lead_id") WHERE "is_holder" = true;

CREATE TABLE IF NOT EXISTS "quote_line_items" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "quote_id" text NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "beneficiary_id" text NOT NULL REFERENCES "lead_beneficiaries"("id") ON DELETE RESTRICT,
  "plan_id" text NOT NULL REFERENCES "carrier_plans"("id"),
  "calculated_value" numeric(12, 2) NOT NULL,
  "age_at_quote" integer NOT NULL,
  "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "quote_line_items_tenant_quote_idx" ON "quote_line_items" ("tenant_id", "quote_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quote_line_items_quote_beneficiary_plan_unique" ON "quote_line_items" ("quote_id", "beneficiary_id", "plan_id");

ALTER TABLE "document_requirements" ADD COLUMN IF NOT EXISTS "applies_per_beneficiary" boolean DEFAULT false NOT NULL;
ALTER TABLE "lead_documents" ADD COLUMN IF NOT EXISTS "beneficiary_id" text REFERENCES "lead_beneficiaries"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "lead_documents_beneficiary_idx" ON "lead_documents" ("beneficiary_id");

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "policy_number" text;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "coverage_start_date" date;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "approved_value" numeric(12, 2);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "confirmation_document_id" text REFERENCES "lead_documents"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "active_customers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sale_id" text NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "clients"("id") ON DELETE SET NULL,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id"),
  "branch_id" text REFERENCES "branches"("id"),
  "status" "active_customer_status" DEFAULT 'active' NOT NULL,
  "coverage_start_date" date NOT NULL,
  "contract_anniversary" date NOT NULL,
  "cancellation_date" date,
  "cancellation_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "active_customers_sale_unique" ON "active_customers" ("sale_id");
CREATE INDEX IF NOT EXISTS "active_customers_tenant_status_idx" ON "active_customers" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "active_customers_branch_idx" ON "active_customers" ("branch_id");

CREATE TABLE IF NOT EXISTS "post_sale_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "chargeback_window_days" integer DEFAULT 90 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "updated_by" text REFERENCES "user"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "post_sale_settings_tenant_unique" ON "post_sale_settings" ("tenant_id");
