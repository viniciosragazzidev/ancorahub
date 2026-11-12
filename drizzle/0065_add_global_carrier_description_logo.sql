-- Fora do journal: aplicar à mão (12/11: ainda não existia em produção e derrubava /super-admin/catalogo).
-- Idempotente: pode rodar mais de uma vez.
ALTER TABLE "global_carriers" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "global_carriers" ADD COLUMN IF NOT EXISTS "logo_url" text;
