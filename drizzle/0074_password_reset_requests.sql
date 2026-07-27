CREATE TABLE IF NOT EXISTS "password_reset_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "user_email" text NOT NULL,
  "user_phone" text,
  "status" text NOT NULL DEFAULT 'requested',
  "token" text,
  "token_expires_at" timestamp with time zone,
  "reviewed_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "director_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "password_reset_requests_tenant_idx" ON "password_reset_requests"("tenant_id", "status");
CREATE INDEX "password_reset_requests_user_idx" ON "password_reset_requests"("user_id");
