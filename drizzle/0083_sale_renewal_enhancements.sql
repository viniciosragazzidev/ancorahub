-- Migration 0083: Sale Renewal Enhancements & Lifecycle Data

DO $$ BEGIN
  CREATE TYPE "payment_method" AS ENUM ('boleto', 'debito_automatico', 'cartao_credito', 'desconto_folha', 'outro');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "renewal_type" AS ENUM ('reajuste_operadora', 'portabilidade', 'manutencao', 'nova_contratacao');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "customer_renewal_status" AS ENUM ('pending_window', 'in_renewal', 'renewed', 'churned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Alter sales table
ALTER TABLE "sales"
ADD COLUMN IF NOT EXISTS "contract_term_months" integer NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS "expiration_date" date,
ADD COLUMN IF NOT EXISTS "renewal_window_start_date" date,
ADD COLUMN IF NOT EXISTS "payment_method" "payment_method" DEFAULT 'boleto',
ADD COLUMN IF NOT EXISTS "renewal_type" "renewal_type" DEFAULT 'reajuste_operadora',
ADD COLUMN IF NOT EXISTS "renewal_contact_preference" text DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS "post_sale_notes" text;

CREATE INDEX IF NOT EXISTS "sales_expiration_idx" ON "sales" ("expiration_date");

-- Alter active_customers table
ALTER TABLE "active_customers"
ADD COLUMN IF NOT EXISTS "contract_term_months" integer NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS "expiration_date" date,
ADD COLUMN IF NOT EXISTS "renewal_window_start_date" date,
ADD COLUMN IF NOT EXISTS "renewal_status" "customer_renewal_status" NOT NULL DEFAULT 'pending_window',
ADD COLUMN IF NOT EXISTS "last_renewal_attempt_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "renewal_notes" text;

CREATE INDEX IF NOT EXISTS "active_customers_expiration_idx" ON "active_customers" ("expiration_date");
CREATE INDEX IF NOT EXISTS "active_customers_renewal_window_idx" ON "active_customers" ("renewal_window_start_date");

-- Create customer_renewal_reminders table
CREATE TABLE IF NOT EXISTS "customer_renewal_reminders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "active_customer_id" text NOT NULL REFERENCES "active_customers"("id") ON DELETE CASCADE,
  "sale_id" text NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "clients"("id") ON DELETE SET NULL,
  "broker_id" text NOT NULL REFERENCES "user"("id"),
  "trigger_type" text NOT NULL,
  "scheduled_for" date NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "processed_at" timestamp with time zone,
  "task_created_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "customer_renewal_reminders_tenant_idx" ON "customer_renewal_reminders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_renewal_reminders_scheduled_idx" ON "customer_renewal_reminders" ("scheduled_for");
CREATE INDEX IF NOT EXISTS "customer_renewal_reminders_status_idx" ON "customer_renewal_reminders" ("status");
