-- Fase 1: Configurações de lembrete de feedback por tenant
-- Adiciona intervalo entre lembretes, máximo de tentativas e flags de canal

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_reminder_interval_minutes" text NOT NULL DEFAULT '30';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_reminder_max_attempts" integer NOT NULL DEFAULT 5;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_push_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "feedback_toast_enabled" boolean NOT NULL DEFAULT true;
