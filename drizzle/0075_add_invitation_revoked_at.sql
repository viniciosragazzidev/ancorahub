ALTER TABLE "broker_invitations"
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamptz;
