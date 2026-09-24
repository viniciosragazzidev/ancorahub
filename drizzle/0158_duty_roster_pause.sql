ALTER TABLE "duty_roster_assignments" ADD COLUMN IF NOT EXISTS "paused_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "duty_roster_assignments" ADD COLUMN IF NOT EXISTS "paused_by" text REFERENCES "user"("id");
