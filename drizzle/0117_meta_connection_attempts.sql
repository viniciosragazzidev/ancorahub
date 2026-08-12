CREATE TABLE IF NOT EXISTS "meta_connection_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "product" text NOT NULL,
  "state_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "access_token_ciphertext" text,
  "asset_snapshot" jsonb,
  "token_expires_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_connection_attempts_state_unique" ON "meta_connection_attempts" ("state_hash");
CREATE INDEX IF NOT EXISTS "meta_connection_attempts_tenant_status_idx" ON "meta_connection_attempts" ("tenant_id", "product", "status");
