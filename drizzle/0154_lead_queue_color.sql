ALTER TABLE "lead_queues" ADD COLUMN IF NOT EXISTS "color_hue" integer;
--> statement-breakpoint
-- Backfill every existing queue with a well-spread hue so colors show up
-- immediately, without waiting for someone to edit each queue. Golden-angle
-- (137.508°) stepping per tenant keeps consecutive queues visually distinct.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) - 1 AS rank
  FROM lead_queues
  WHERE deleted_at IS NULL AND color_hue IS NULL
)
UPDATE lead_queues
SET color_hue = MOD(CAST(ROUND(ranked.rank * 137.508) AS integer), 360)
FROM ranked
WHERE lead_queues.id = ranked.id;
