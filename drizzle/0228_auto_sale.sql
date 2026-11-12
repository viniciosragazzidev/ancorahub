-- Venda Automatizada (piloto, 12/11/2026): uma negociação conduzida pela IA por empresa.
-- Plano: docs/implementations/active/2026-11-12-venda-automatizada.md (DEC-182)
-- Aditivo. Sem as tabelas, a área mostra "Aguardando a migração" e nada muda no restante do CRM.

CREATE TABLE IF NOT EXISTS "auto_sale_deals" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "stage" text NOT NULL DEFAULT 'chosen' CHECK ("stage" IN ('chosen', 'confirming', 'preferences', 'quoted', 'recommending', 'objections', 'closing', 'documents', 'manager_called', 'handed_off', 'won', 'lost')),
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'paused', 'waiting_manager', 'handed_off', 'won', 'lost', 'cancelled')),
  "mode" text NOT NULL DEFAULT 'copilot' CHECK ("mode" IN ('simulation', 'copilot', 'autopilot')),
  "channel" text NOT NULL DEFAULT 'meta' CHECK ("channel" IN ('meta', 'waha')),
  "waha_number_id" text REFERENCES "waha_numbers"("id") ON DELETE SET NULL,
  -- O gestor que escolheu a negociação: o único que o agente chama.
  "chosen_by" text NOT NULL REFERENCES "user"("id"),
  -- Vazio até o gestor entregar a negociação a alguém por escolha manual.
  "handed_to_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "handed_at" timestamp with time zone,
  "facts" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "manager_call_reason" text,
  "manager_called_at" timestamp with time zone,
  "misunderstood_count" integer NOT NULL DEFAULT 0,
  "follow_up_step" integer NOT NULL DEFAULT 0,
  "next_follow_up_at" timestamp with time zone,
  -- Fim da rajada do cliente: o job responde depois de 75 s sem mensagem nova.
  "reply_due_at" timestamp with time zone,
  "last_customer_message_at" timestamp with time zone,
  "last_agent_message_at" timestamp with time zone,
  "first_quote_at" timestamp with time zone,
  "documents_requested_at" timestamp with time zone,
  "ai_cost_usd" numeric(10, 6) NOT NULL DEFAULT 0,
  "transcription_cost_usd" numeric(10, 6) NOT NULL DEFAULT 0,
  "ai_conversation_paused" boolean NOT NULL DEFAULT false,
  -- O que a escolha mudou no lead (distribuição e conversa de IA), para devolver ao fim da negociação.
  "restore_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ended_reason" text,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Só uma negociação ativa por empresa no piloto.
CREATE UNIQUE INDEX IF NOT EXISTS "auto_sale_deals_one_active_per_tenant"
  ON "auto_sale_deals" ("tenant_id") WHERE "status" IN ('active', 'paused', 'waiting_manager');
CREATE UNIQUE INDEX IF NOT EXISTS "auto_sale_deals_one_active_per_lead"
  ON "auto_sale_deals" ("tenant_id", "lead_id") WHERE "status" IN ('active', 'paused', 'waiting_manager');
CREATE INDEX IF NOT EXISTS "auto_sale_deals_tenant_created_idx" ON "auto_sale_deals" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "auto_sale_deals_reply_due_idx" ON "auto_sale_deals" ("reply_due_at") WHERE "reply_due_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "auto_sale_deals_follow_up_idx" ON "auto_sale_deals" ("next_follow_up_at") WHERE "next_follow_up_at" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "auto_sale_turns" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "deal_id" text NOT NULL REFERENCES "auto_sale_deals"("id") ON DELETE CASCADE,
  "direction" text NOT NULL CHECK ("direction" IN ('in', 'out', 'system')),
  "kind" text NOT NULL,
  "provider_message_id" text,
  "body" text,
  "intent" text,
  "objection" text,
  "facts" jsonb,
  "decision" jsonb,
  "guard" jsonb,
  "model" text,
  "ai_cost_usd" numeric(10, 6),
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Idempotência por mensagem: o mesmo webhook duas vezes grava um turno só.
CREATE UNIQUE INDEX IF NOT EXISTS "auto_sale_turns_message_unique"
  ON "auto_sale_turns" ("tenant_id", "provider_message_id") WHERE "provider_message_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "auto_sale_turns_deal_created_idx" ON "auto_sale_turns" ("deal_id", "created_at");

CREATE TABLE IF NOT EXISTS "auto_sale_offers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "deal_id" text NOT NULL REFERENCES "auto_sale_deals"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "input" jsonb NOT NULL,
  "plans" jsonb NOT NULL,
  "recommended_plan_id" text,
  "recommendation_reason" text,
  "relaxed" jsonb,
  "previous_offer_id" text,
  "release" text NOT NULL,
  "catalog_date" text NOT NULL,
  "pdf_key" text,
  "pdf_sha256" text,
  "image_keys" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "auto_sale_offers_deal_version_unique" ON "auto_sale_offers" ("deal_id", "version");
CREATE INDEX IF NOT EXISTS "auto_sale_offers_tenant_created_idx" ON "auto_sale_offers" ("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "auto_sale_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "deal_id" text NOT NULL REFERENCES "auto_sale_deals"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('text', 'document', 'image')),
  "body" text,
  "media_key" text,
  "media_filename" text,
  "media_mime" text,
  "offer_id" text REFERENCES "auto_sale_offers"("id") ON DELETE SET NULL,
  "status" text NOT NULL CHECK ("status" IN ('draft', 'simulated', 'approved', 'sending', 'sent', 'held', 'failed', 'cancelled')),
  "hold_reason" text,
  "channel" text NOT NULL CHECK ("channel" IN ('meta', 'waha')),
  "idempotency_key" text NOT NULL,
  "approved_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "provider_message_id" text,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "auto_sale_outbox_idempotency_unique" ON "auto_sale_outbox" ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "auto_sale_outbox_status_idx" ON "auto_sale_outbox" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "auto_sale_outbox_deal_idx" ON "auto_sale_outbox" ("deal_id", "created_at");

CREATE TABLE IF NOT EXISTS "auto_sale_promotions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "operator" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "starts_on" date NOT NULL,
  "ends_on" date NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ("ends_on" >= "starts_on")
);

CREATE INDEX IF NOT EXISTS "auto_sale_promotions_tenant_active_idx" ON "auto_sale_promotions" ("tenant_id", "active", "ends_on");

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE "auto_sale_deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auto_sale_turns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auto_sale_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auto_sale_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auto_sale_promotions" ENABLE ROW LEVEL SECURITY;
