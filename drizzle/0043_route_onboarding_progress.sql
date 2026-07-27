CREATE TABLE IF NOT EXISTS "route_onboarding_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "route_key" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "completed_at" timestamptz,
  "last_seen_at" timestamptz,
  "reset_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "route_onboarding_progress_user_route_unique"
  ON "route_onboarding_progress" ("tenant_id", "user_id", "route_key");
CREATE INDEX IF NOT EXISTS "route_onboarding_progress_user_idx"
  ON "route_onboarding_progress" ("tenant_id", "user_id");
