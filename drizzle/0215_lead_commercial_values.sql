-- Snapshot mensal de valor e vidas do lead, alimentado por cotação ou edição manual.
-- A aplicação deve ocorrer antes do deploy; as colunas são opcionais e sem backfill pesado.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "monthly_value" numeric(12, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lives_count" integer;
