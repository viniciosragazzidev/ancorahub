CREATE TABLE "post_sale_campaigns" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "audience" jsonb NOT NULL,
  "opening_message" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'running', 'done', 'cancelled')),
  "totals" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "started_at" timestamptz,
  "finished_at" timestamptz
);

CREATE TABLE "post_sale_surveys" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "campaign_id" text NOT NULL REFERENCES "post_sale_campaigns"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "broker_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "phone" text NOT NULL,
  "status" text NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'sent', 'answering', 'completed', 'no_reply', 'opted_out', 'failed', 'skipped')),
  "step" integer NOT NULL DEFAULT 0,
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "outcome" text CHECK ("outcome" IS NULL OR "outcome" IN ('ok', 'no_contact', 'bad_service', 'closed', 'waiting', 'other')),
  "rating" integer CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5),
  "outbound_id" text REFERENCES "whatsapp_outbound_messages"("id") ON DELETE SET NULL,
  "channel_type" text CHECK ("channel_type" IS NULL OR "channel_type" IN ('waha', 'meta')),
  "channel_ref" text,
  "skip_reason" text,
  "sent_at" timestamptz,
  "last_reply_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "post_sale_campaigns_tenant_created_idx" ON "post_sale_campaigns" ("tenant_id", "created_at");
CREATE INDEX "post_sale_campaigns_tenant_status_idx" ON "post_sale_campaigns" ("tenant_id", "status");
CREATE UNIQUE INDEX "post_sale_surveys_tenant_campaign_lead_unique" ON "post_sale_surveys" ("tenant_id", "campaign_id", "lead_id");
CREATE INDEX "post_sale_surveys_tenant_broker_idx" ON "post_sale_surveys" ("tenant_id", "broker_id");
CREATE INDEX "post_sale_surveys_tenant_lead_status_idx" ON "post_sale_surveys" ("tenant_id", "lead_id", "status");
CREATE INDEX "post_sale_surveys_tenant_campaign_status_idx" ON "post_sale_surveys" ("tenant_id", "campaign_id", "status");
CREATE INDEX "post_sale_surveys_tenant_channel_idx" ON "post_sale_surveys" ("tenant_id", "channel_type", "channel_ref");
