DO $$ BEGIN
  CREATE TYPE "catalog_status" AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "catalog_import_status" AS ENUM ('draft', 'validating', 'ready_for_review', 'published', 'rejected', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "catalog_source" AS ENUM ('global', 'tenant_private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "global_carriers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "ans_code" text,
  "status" "catalog_status" NOT NULL DEFAULT 'draft',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "global_carriers_name_unique" ON "global_carriers" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "global_carriers_ans_code_unique" ON "global_carriers" ("ans_code") WHERE "ans_code" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "global_carriers_status_idx" ON "global_carriers" ("status");

CREATE TABLE IF NOT EXISTS "global_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "carrier_id" text NOT NULL REFERENCES "global_carriers"("id"),
  "name" text NOT NULL,
  "code" text,
  "type" "plan_type" NOT NULL DEFAULT 'individual',
  "description" text,
  "coverage" text,
  "ans_registration" text,
  "max_entry_age" integer,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" "catalog_status" NOT NULL DEFAULT 'draft',
  "created_by" text REFERENCES "user"("id"),
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "global_plans_carrier_status_idx" ON "global_plans" ("carrier_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "global_plans_carrier_code_unique" ON "global_plans" ("carrier_id", "code") WHERE "code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "catalog_price_tables" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL REFERENCES "global_plans"("id"),
  "name" text NOT NULL,
  "code" text,
  "status" "catalog_status" NOT NULL DEFAULT 'draft',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "catalog_price_tables_plan_status_idx" ON "catalog_price_tables" ("plan_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_price_tables_plan_code_unique" ON "catalog_price_tables" ("plan_id", "code") WHERE "code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "catalog_table_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "price_table_id" text NOT NULL REFERENCES "catalog_price_tables"("id"),
  "version_number" integer NOT NULL,
  "status" "catalog_status" NOT NULL DEFAULT 'draft',
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "source_label" text,
  "content_hash" text,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "published_by" text REFERENCES "user"("id"),
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_table_versions_table_number_unique" UNIQUE ("price_table_id", "version_number")
);
CREATE INDEX IF NOT EXISTS "catalog_table_versions_lookup_idx" ON "catalog_table_versions" ("price_table_id", "status", "effective_from");

CREATE TABLE IF NOT EXISTS "catalog_price_rows" (
  "id" text PRIMARY KEY NOT NULL,
  "table_version_id" text NOT NULL REFERENCES "catalog_table_versions"("id") ON DELETE CASCADE,
  "age_band" text NOT NULL,
  "min_age" integer,
  "max_age" integer,
  "monthly_price" numeric(12, 2) NOT NULL,
  "criteria" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalog_price_rows_version_age_band_unique" UNIQUE ("table_version_id", "age_band")
);
CREATE INDEX IF NOT EXISTS "catalog_price_rows_version_idx" ON "catalog_price_rows" ("table_version_id");

CREATE TABLE IF NOT EXISTS "tenant_catalog_plan_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "global_plan_id" text NOT NULL REFERENCES "global_plans"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "favorite" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_catalog_plan_settings_tenant_plan_unique" UNIQUE ("tenant_id", "global_plan_id")
);
CREATE INDEX IF NOT EXISTS "tenant_catalog_plan_settings_tenant_enabled_idx" ON "tenant_catalog_plan_settings" ("tenant_id", "enabled");

CREATE TABLE IF NOT EXISTS "branch_catalog_plan_restrictions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
  "global_plan_id" text NOT NULL REFERENCES "global_plans"("id") ON DELETE CASCADE,
  "restricted" boolean NOT NULL DEFAULT true,
  "updated_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "branch_catalog_plan_restrictions_branch_plan_unique" UNIQUE ("branch_id", "global_plan_id")
);
CREATE INDEX IF NOT EXISTS "branch_catalog_plan_restrictions_tenant_branch_idx" ON "branch_catalog_plan_restrictions" ("tenant_id", "branch_id");

CREATE TABLE IF NOT EXISTS "tenant_private_carriers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "ans_code" text,
  "contact" text,
  "phone" text,
  "email" text,
  "active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_private_carriers_tenant_name_unique" UNIQUE ("tenant_id", "name")
);
CREATE INDEX IF NOT EXISTS "tenant_private_carriers_tenant_active_idx" ON "tenant_private_carriers" ("tenant_id", "active");

CREATE TABLE IF NOT EXISTS "tenant_private_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "carrier_id" text NOT NULL REFERENCES "tenant_private_carriers"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text,
  "type" "plan_type" NOT NULL DEFAULT 'individual',
  "description" text,
  "coverage" text,
  "ans_registration" text,
  "max_entry_age" integer,
  "active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tenant_private_plans_tenant_carrier_active_idx" ON "tenant_private_plans" ("tenant_id", "carrier_id", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_private_plans_carrier_code_unique" ON "tenant_private_plans" ("carrier_id", "code") WHERE "code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "tenant_private_price_tables" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan_id" text NOT NULL REFERENCES "tenant_private_plans"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "code" text,
  "active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tenant_private_price_tables_tenant_plan_idx" ON "tenant_private_price_tables" ("tenant_id", "plan_id", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_private_price_tables_plan_code_unique" ON "tenant_private_price_tables" ("plan_id", "code") WHERE "code" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "tenant_private_table_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "price_table_id" text NOT NULL REFERENCES "tenant_private_price_tables"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "status" "catalog_status" NOT NULL DEFAULT 'draft',
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "source_label" text,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "published_by" text REFERENCES "user"("id"),
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_private_table_versions_table_number_unique" UNIQUE ("price_table_id", "version_number")
);
CREATE INDEX IF NOT EXISTS "tenant_private_table_versions_lookup_idx" ON "tenant_private_table_versions" ("tenant_id", "price_table_id", "status", "effective_from");

CREATE TABLE IF NOT EXISTS "tenant_private_price_rows" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "table_version_id" text NOT NULL REFERENCES "tenant_private_table_versions"("id") ON DELETE CASCADE,
  "age_band" text NOT NULL,
  "min_age" integer,
  "max_age" integer,
  "monthly_price" numeric(12, 2) NOT NULL,
  "criteria" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_private_price_rows_version_age_band_unique" UNIQUE ("table_version_id", "age_band")
);
CREATE INDEX IF NOT EXISTS "tenant_private_price_rows_tenant_version_idx" ON "tenant_private_price_rows" ("tenant_id", "table_version_id");

CREATE TABLE IF NOT EXISTS "catalog_import_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "source" "catalog_source" NOT NULL,
  "target_tenant_id" text REFERENCES "tenants"("id") ON DELETE CASCADE,
  "status" "catalog_import_status" NOT NULL DEFAULT 'draft',
  "file_name" text,
  "content_hash" text,
  "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "catalog_import_batches_source_status_idx" ON "catalog_import_batches" ("source", "status");
CREATE INDEX IF NOT EXISTS "catalog_import_batches_tenant_idx" ON "catalog_import_batches" ("target_tenant_id");

CREATE TABLE IF NOT EXISTS "catalog_change_sets" (
  "id" text PRIMARY KEY NOT NULL,
  "import_batch_id" text REFERENCES "catalog_import_batches"("id") ON DELETE SET NULL,
  "source" "catalog_source" NOT NULL,
  "target_tenant_id" text REFERENCES "tenants"("id") ON DELETE CASCADE,
  "status" "catalog_import_status" NOT NULL DEFAULT 'draft',
  "base_version_id" text,
  "proposed_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "reviewed_by" text REFERENCES "user"("id"),
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "catalog_change_sets_source_status_idx" ON "catalog_change_sets" ("source", "status");
CREATE INDEX IF NOT EXISTS "catalog_change_sets_tenant_idx" ON "catalog_change_sets" ("target_tenant_id");

CREATE TABLE IF NOT EXISTS "catalog_audit_events" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "user"("id"),
  "tenant_id" text REFERENCES "tenants"("id") ON DELETE CASCADE,
  "source" "catalog_source" NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "catalog_audit_events_tenant_created_idx" ON "catalog_audit_events" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "catalog_audit_events_actor_created_idx" ON "catalog_audit_events" ("actor_user_id", "created_at");

-- Existing tenant catalog data becomes a private extension. IDs are intentionally
-- reused so old references can be migrated incrementally without rewriting history.
INSERT INTO "tenant_private_carriers" ("id", "tenant_id", "name", "ans_code", "contact", "phone", "email", "active", "metadata", "created_at", "updated_at")
SELECT "id", "tenant_id", "name", "ans_code", "contact", "phone", "email", "status" = 'active', '{}'::jsonb, "created_at", "updated_at"
FROM "carriers"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tenant_private_plans" ("id", "tenant_id", "carrier_id", "name", "type", "description", "coverage", "ans_registration", "max_entry_age", "active", "metadata", "created_at", "updated_at")
SELECT "id", "tenant_id", "carrier_id", "name", "type", "description", "coverage", "ans_registration", "max_entry_age", "active", COALESCE("details", '{}'::jsonb), "created_at", "updated_at"
FROM "carrier_plans"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tenant_private_price_tables" ("id", "tenant_id", "plan_id", "name", "code", "active", "metadata", "created_at", "updated_at")
SELECT 'legacy-table-' || "id", "tenant_id", "id", 'Tabela legada', 'legacy', true, '{}'::jsonb, "created_at", "updated_at"
FROM "carrier_plans"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tenant_private_table_versions" ("id", "tenant_id", "price_table_id", "version_number", "status", "effective_from", "source_label", "snapshot", "created_at", "updated_at")
SELECT 'legacy-version-' || "id", "tenant_id", 'legacy-table-' || "id", 1, 'published', COALESCE("created_at", now()), 'legacy_migration', '{}'::jsonb, "created_at", "updated_at"
FROM "carrier_plans"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "tenant_private_price_rows" ("id", "tenant_id", "table_version_id", "age_band", "monthly_price", "criteria", "created_at")
SELECT "id", "tenant_id", 'legacy-version-' || "plan_id", "age_band", "monthly_price", '{}'::jsonb, "created_at"
FROM "carrier_plan_prices"
ON CONFLICT ("id") DO NOTHING;
