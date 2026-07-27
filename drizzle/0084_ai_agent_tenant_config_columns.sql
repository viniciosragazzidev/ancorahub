ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "business_hours_start" text;
--> statement-breakpoint
ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "business_hours_end" text;
--> statement-breakpoint
ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "business_days" text;
--> statement-breakpoint
ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "required_fields" jsonb;
--> statement-breakpoint
ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "custom_instructions" text;
