-- Snapshot mensal de valor e vidas do lead, e valores de auditoria antes/depois.
-- Aplicar antes do deploy; colunas aditivas, sem backfill.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "monthly_value" numeric(12, 2);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lives_count" integer;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
