ALTER TABLE "user_onboarding"
  ADD COLUMN IF NOT EXISTS "current_step" text,
  ADD COLUMN IF NOT EXISTS "email_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "password_created_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "personal_data_completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamptz;
