-- Central queues are tenant-wide and therefore do not require a branch.
ALTER TABLE "lead_queues"
  ALTER COLUMN "branch_id" DROP NOT NULL;
