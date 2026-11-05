-- Etapas bem definidas e funil profissional (05/11/2026).
-- Plano: docs/implementations/active/2026-11-05-etapas-e-funil.md
-- Aplicar antes do deploy. Tudo aditivo: valor novo de enum, duas colunas opcionais e duas tabelas novas.
-- Observação: ALTER TYPE ... ADD VALUE precisa rodar fora de transação em versões antigas do Postgres;
-- rode este comando sozinho primeiro se o editor reclamar.

ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'awaiting_reply' BEFORE 'converted';

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_hold_until" timestamp with time zone;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_before_awaiting" "lead_status";

CREATE TABLE IF NOT EXISTS "lead_stage_history" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "from_status" "lead_status",
  "to_status" "lead_status" NOT NULL,
  "changed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "actor_type" text NOT NULL,
  "actor_user_id" text,
  "reason" text,
  "loss_code" text,
  "seconds_in_previous" integer,
  "branch_id" text,
  "queue_id" text,
  "source_channel" text,
  "meta_campaign_id" text,
  "meta_ad_id" text,
  "meta_form_id" text,
  "backfilled" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "lead_stage_history_tenant_changed_idx" ON "lead_stage_history" ("tenant_id", "changed_at");
CREATE INDEX IF NOT EXISTS "lead_stage_history_lead_idx" ON "lead_stage_history" ("lead_id", "changed_at");

CREATE TABLE IF NOT EXISTS "lead_funnel_events" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "step_key" text,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "dedupe_key" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "queue_id" text,
  "branch_id" text,
  "source_channel" text,
  "meta_campaign_id" text,
  "meta_ad_id" text,
  "meta_form_id" text
);
CREATE INDEX IF NOT EXISTS "lead_funnel_events_tenant_event_idx" ON "lead_funnel_events" ("tenant_id", "event", "occurred_at");
CREATE INDEX IF NOT EXISTS "lead_funnel_events_lead_idx" ON "lead_funnel_events" ("lead_id", "occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "lead_funnel_events_dedupe_unique" ON "lead_funnel_events" ("tenant_id", "dedupe_key");

-- RLS como as demais tabelas públicas (fix/seguranca-rls-supabase): só o servidor acessa.
ALTER TABLE "lead_stage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_funnel_events" ENABLE ROW LEVEL SECURITY;
