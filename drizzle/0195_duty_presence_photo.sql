-- Plantão presencial: o corretor confirma a presença com uma foto do local (decisão de 2026-10-12).
-- Só adiciona colunas que aceitam nulo, sem valor padrão: não reescreve a tabela.
ALTER TABLE "duty_presence_confirmations" ADD COLUMN IF NOT EXISTS "photo_storage_key" text;
--> statement-breakpoint
ALTER TABLE "duty_presence_confirmations" ADD COLUMN IF NOT EXISTS "photo_taken_at" timestamptz;
