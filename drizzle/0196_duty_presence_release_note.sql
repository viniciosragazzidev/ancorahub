-- Plantão presencial (2026-10-12): liberar sem a foto do local exige um motivo, guardado aqui.
-- Só adiciona uma coluna que aceita nulo, sem valor padrão: não reescreve a tabela.
ALTER TABLE "duty_presence_confirmations" ADD COLUMN IF NOT EXISTS "release_note" text;
