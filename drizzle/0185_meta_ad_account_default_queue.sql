ALTER TABLE meta_ad_accounts
  ADD COLUMN IF NOT EXISTS default_queue_id text REFERENCES lead_queues(id) ON DELETE SET NULL;
