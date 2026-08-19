ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential' AND ("issuer" IS NULL OR "issuer" = '');
