ALTER TABLE "ai_qualification_configs"
  ALTER COLUMN "max_questions" SET DEFAULT 6;
--> statement-breakpoint
UPDATE "ai_qualification_configs"
SET "max_questions" = 6, "updated_at" = now()
WHERE "max_questions" < 6;
