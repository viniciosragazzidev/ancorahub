-- Colunas de suporte ao montador de cotacao interno.
-- As tabelas quotes, quote_items, quote_line_items ja existem.
ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "lead_name" text,
  ADD COLUMN IF NOT EXISTS "lead_phone" text,
  ADD COLUMN IF NOT EXISTS "total_monthly" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "beneficiary_count" integer;
