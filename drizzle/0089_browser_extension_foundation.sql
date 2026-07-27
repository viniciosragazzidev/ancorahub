CREATE TABLE IF NOT EXISTS "extension_auth_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "code_hash" text NOT NULL UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "extension_auth_codes_expiry_idx" ON "extension_auth_codes" ("expires_at");

CREATE TABLE IF NOT EXISTS "extension_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "device_id" text NOT NULL,
  "extension_version" text NOT NULL,
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "last_seen_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "extension_sessions_user_idx" ON "extension_sessions" ("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "extension_sessions_tenant_idx" ON "extension_sessions" ("tenant_id", "revoked_at");

CREATE TABLE IF NOT EXISTS "extension_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "minimum_version" text NOT NULL DEFAULT '0.1.0',
  "allow_insert" boolean NOT NULL DEFAULT true,
  "max_suggestions" integer NOT NULL DEFAULT 3,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "extension_settings_tenant_unique" ON "extension_settings" ("tenant_id");

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
