-- Snapshot mensal de valor e vidas do lead, alimentado por cotação ou edição manual.
-- Aplicar no Supabase antes do deploy da aplicação.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "monthly_value" numeric(12, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lives_count" integer;
