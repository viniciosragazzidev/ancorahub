ALTER TABLE post_sale_campaigns
  ADD COLUMN kind text NOT NULL DEFAULT 'manual',
  ADD COLUMN rule_key text;

ALTER TABLE post_sale_surveys
  ADD COLUMN rule_key text,
  ADD COLUMN reminder_sent_at timestamptz;

CREATE INDEX post_sale_surveys_tenant_lead_created_idx
  ON post_sale_surveys (tenant_id, lead_id, created_at DESC);

CREATE INDEX post_sale_surveys_reminder_due_idx
  ON post_sale_surveys (status, sent_at)
  WHERE status IN ('sent', 'answering');
