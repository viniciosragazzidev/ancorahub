ALTER TABLE "broker_invitations"
  ADD COLUMN IF NOT EXISTS "role" "tenant_role" NOT NULL DEFAULT 'broker',
  ADD COLUMN IF NOT EXISTS "job_title" text NOT NULL DEFAULT 'broker',
  ADD COLUMN IF NOT EXISTS "token_ciphertext" text,
  ADD COLUMN IF NOT EXISTS "delivery_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "delivery_message_id" text,
  ADD COLUMN IF NOT EXISTS "delivery_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delivery_error" text,
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz;

CREATE INDEX IF NOT EXISTS "broker_invitations_delivery_status_idx"
  ON "broker_invitations" ("tenant_id", "delivery_status");
