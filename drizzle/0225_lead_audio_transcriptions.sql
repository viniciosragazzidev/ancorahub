-- IA de qualificação entende áudio (10/11/2026): os 2 primeiros áudios de um lead em qualificação.
-- Plano: docs/implementations/active/2026-11-10-ia-qualificacao-audio.md
-- Aditivo. Sem a tabela, a transcrição fica desligada e o áudio segue como antes.

CREATE TABLE IF NOT EXISTS "lead_audio_transcriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "provider_message_id" text NOT NULL,
  -- 1 ou 2 quando o áudio foi ao provedor (gasta a vez); nulo quando não foi.
  "slot" integer CHECK ("slot" IS NULL OR "slot" BETWEEN 1 AND 2),
  "status" text NOT NULL CHECK ("status" IN ('pending', 'transcribed', 'failed', 'over_limit', 'too_long', 'no_file')),
  "duration_seconds" numeric(8, 2),
  "provider" text,
  "model" text,
  "estimated_cost_usd" numeric(10, 6),
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- A vez é única por lead: dois áudios ao mesmo tempo nunca passam de 2.
CREATE UNIQUE INDEX IF NOT EXISTS "lead_audio_transcriptions_lead_slot_unique"
  ON "lead_audio_transcriptions" ("tenant_id", "lead_id", "slot") WHERE "slot" IS NOT NULL;

-- Um registro por mensagem: o mesmo áudio reprocessado não gasta outra vez.
CREATE UNIQUE INDEX IF NOT EXISTS "lead_audio_transcriptions_message_unique"
  ON "lead_audio_transcriptions" ("tenant_id", "provider_message_id");

CREATE INDEX IF NOT EXISTS "lead_audio_transcriptions_tenant_created_idx"
  ON "lead_audio_transcriptions" ("tenant_id", "created_at");

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE "lead_audio_transcriptions" ENABLE ROW LEVEL SECURITY;
