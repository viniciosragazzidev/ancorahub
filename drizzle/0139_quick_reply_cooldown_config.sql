-- Migration: Adiciona campos de cooldown do quick-reply à tabela ai_qualification_configs
-- Permite que cada tenant configure seus próprios limites em vez de valores hardcoded no código.

ALTER TABLE "ai_qualification_configs"
  ADD COLUMN IF NOT EXISTS "quick_reply_cooldown_minutes" integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "quick_reply_wait_window_minutes" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "quick_reply_wait_limit_count" integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN "ai_qualification_configs"."quick_reply_cooldown_minutes"
  IS 'Minutos de cooldown antes de repetir o mesmo template de quick reply para o mesmo lead.';

COMMENT ON COLUMN "ai_qualification_configs"."quick_reply_wait_window_minutes"
  IS 'Janela de tempo (minutos) para contar respostas de aguardando humano antes de suprimir.';

COMMENT ON COLUMN "ai_qualification_configs"."quick_reply_wait_limit_count"
  IS 'Número máximo de respostas de aguardando dentro da janela antes de suprimir novas respostas.';
