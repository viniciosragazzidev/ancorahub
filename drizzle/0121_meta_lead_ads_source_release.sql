DROP INDEX IF EXISTS "meta_lead_ad_sources_page_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "meta_lead_ad_sources_active_page_unique"
  ON "meta_lead_ad_sources" ("page_id")
  WHERE "status" = 'active';

ALTER TABLE "meta_campaign_queue_routes"
  ALTER COLUMN "queue_id" DROP NOT NULL;
