ALTER TABLE "terms_acceptances"
  ADD COLUMN IF NOT EXISTS "ip_address" text,
  ADD COLUMN IF NOT EXISTS "user_agent" text;
