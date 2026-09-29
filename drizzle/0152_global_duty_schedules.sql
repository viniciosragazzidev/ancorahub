ALTER TABLE "unit_duty_schedules"
  ALTER COLUMN "branch_id" DROP NOT NULL;

ALTER TABLE "unit_duty_schedules"
  ALTER COLUMN "queue_id" DROP NOT NULL;
