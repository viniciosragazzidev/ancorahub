CREATE TABLE IF NOT EXISTS "companies" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text REFERENCES "branches"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "cnpj" text,
  "employee_count" integer,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_tenant_branch_idx" ON "companies" ("tenant_id", "branch_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenant_cnpj_unique" ON "companies" ("tenant_id", "cnpj") WHERE "cnpj" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "company_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_company_idx" ON "leads" ("tenant_id", "company_id");
