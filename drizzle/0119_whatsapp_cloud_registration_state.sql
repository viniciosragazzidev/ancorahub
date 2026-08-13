-- The registration PIN is encrypted application-side and never returned to clients.
ALTER TABLE "communication_channels"
  ADD COLUMN IF NOT EXISTS "registration_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "registration_pin_ciphertext" text,
  ADD COLUMN IF NOT EXISTS "registration_error_code" text,
  ADD COLUMN IF NOT EXISTS "registered_at" timestamp with time zone;

-- Existing rows predate provider-confirmed registration. Preserve their current
-- delivery behavior while making that historical state explicit in the UI.
UPDATE "communication_channels"
SET "registration_status" = 'legacy_unverified'
WHERE "provider" = 'meta_cloud'
  AND "status" = 'active'
  AND "registration_status" = 'pending';

CREATE INDEX IF NOT EXISTS "communication_channels_tenant_registration_idx"
  ON "communication_channels" ("tenant_id", "provider", "registration_status");
