ALTER TABLE post_sale_surveys
  ADD COLUMN last_inbound_message_id text,
  ADD COLUMN pending_reply_text text,
  ADD COLUMN media_text_prompt_step integer;

CREATE TABLE post_sale_opt_outs (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  survey_id text REFERENCES post_sale_surveys(id) ON DELETE SET NULL,
  channel_type text CHECK (channel_type IN ('waha', 'meta')),
  channel_ref text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX post_sale_opt_outs_tenant_lead_unique
  ON post_sale_opt_outs (tenant_id, lead_id);

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE post_sale_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_sale_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_sale_opt_outs ENABLE ROW LEVEL SECURITY;
