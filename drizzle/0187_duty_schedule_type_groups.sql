-- Plantão types become the "group" of a plantão (PME, Premium, Presencial...):
-- each type carries its modality, a color, the units that take part in it and
-- the default hours/coverage used when plantões of the type are created.
-- The escala keeps what the planner chose (period, types, brokers and seats).
ALTER TABLE "duty_schedule_types"
  ADD COLUMN IF NOT EXISTS "attendance_mode" text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS "color_hue" integer,
  ADD COLUMN IF NOT EXISTS "branch_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "default_starts_at" text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS "default_ends_at" text NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS "default_minimum_brokers" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "default_maximum_brokers" integer,
  ADD COLUMN IF NOT EXISTS "updated_by" text REFERENCES "user"("id");
--> statement-breakpoint
ALTER TABLE "duty_schedule_types" DROP CONSTRAINT IF EXISTS "duty_schedule_types_attendance_mode_check";
--> statement-breakpoint
ALTER TABLE "duty_schedule_types"
  ADD CONSTRAINT "duty_schedule_types_attendance_mode_check" CHECK ("attendance_mode" IN ('online', 'presencial'));
--> statement-breakpoint
ALTER TABLE "duty_schedule_types" DROP CONSTRAINT IF EXISTS "duty_schedule_types_color_hue_check";
--> statement-breakpoint
ALTER TABLE "duty_schedule_types"
  ADD CONSTRAINT "duty_schedule_types_color_hue_check" CHECK ("color_hue" IS NULL OR "color_hue" BETWEEN 0 AND 359);
--> statement-breakpoint
-- Existing types: modality from their plantões (majority), and a distinct color each.
UPDATE "duty_schedule_types" t
SET "attendance_mode" = 'presencial'
WHERE (
  SELECT count(*) FILTER (WHERE s."attendance_mode" = 'presencial') > count(*) FILTER (WHERE s."attendance_mode" = 'online')
  FROM "unit_duty_schedules" s WHERE s."type_id" = t."id"
);
--> statement-breakpoint
UPDATE "duty_schedule_types" t
SET "color_hue" = ranked.hue
FROM (
  SELECT "id", ((row_number() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") - 1) * 137 + 208) % 360 AS hue
  FROM "duty_schedule_types"
) ranked
WHERE ranked."id" = t."id" AND t."color_hue" IS NULL;
--> statement-breakpoint
ALTER TABLE "duty_schedule_monthly_plans"
  ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;
