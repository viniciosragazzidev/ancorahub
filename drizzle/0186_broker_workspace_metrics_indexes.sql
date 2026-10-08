CREATE INDEX IF NOT EXISTS lead_offers_broker_accepted_at_partial_idx
  ON lead_offers (broker_id, accepted_at)
  WHERE accepted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_corretor_assigned_at_live_idx
  ON leads (corretor_id, assigned_at)
  WHERE deleted_at IS NULL;
