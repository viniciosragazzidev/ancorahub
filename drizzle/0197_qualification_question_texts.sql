-- Fluxo de atendimento (2026-10-13): o diretor escreve o texto de cada pergunta de qualificação.
-- Só adiciona uma coluna que aceita nulo, sem valor padrão: não reescreve a tabela.
ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "question_texts" jsonb;
