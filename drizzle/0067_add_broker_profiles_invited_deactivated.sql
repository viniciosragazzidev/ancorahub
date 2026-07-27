ALTER TABLE "broker_profiles" ADD COLUMN IF NOT EXISTS "invited_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "broker_profiles" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "broker_profiles" ALTER COLUMN "activated_at" TYPE timestamp with time zone;
