DO $$ BEGIN
  CREATE TYPE "custom_role_status" AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "custom_role_scope" AS ENUM ('none', 'own', 'branch', 'tenant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "color" text NOT NULL DEFAULT 'primary',
  "icon" text NOT NULL DEFAULT 'shield',
  "scope" "custom_role_scope" NOT NULL DEFAULT 'none',
  "status" "custom_role_status" NOT NULL DEFAULT 'draft',
  "version" integer NOT NULL DEFAULT 1,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "custom_roles_tenant_name_unique" ON "custom_roles" ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "custom_roles_tenant_status_idx" ON "custom_roles" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "custom_role_permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "custom_role_id" text NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
  "permission_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "custom_role_permission_unique" ON "custom_role_permissions" ("custom_role_id", "permission_key");
CREATE INDEX IF NOT EXISTS "custom_role_permissions_key_idx" ON "custom_role_permissions" ("permission_key");

CREATE TABLE IF NOT EXISTS "custom_role_events" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "custom_role_id" text NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
  "actor_user_id" text NOT NULL REFERENCES "user"("id"),
  "action" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "custom_role_events_role_created_idx" ON "custom_role_events" ("custom_role_id", "created_at");

CREATE TABLE IF NOT EXISTS "tenant_custom_role_settings" (
  "tenant_id" text PRIMARY KEY NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "custom_role_id" text REFERENCES "custom_roles"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "tenant_memberships_custom_role_idx" ON "tenant_memberships" ("custom_role_id");
