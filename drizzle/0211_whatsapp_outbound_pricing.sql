-- Qualificação turbo (plano docs/implementations/active/2026-10-21-qualificacao-turbo.md, Fase 0):
-- guarda o preço que a Meta informa em cada status de mensagem (cobrança por
-- mensagem entregue desde 1/10/2026). Só colunas novas e opcionais em
-- whatsapp_outbound_messages; o código grava e lê por SQL direto e funciona
-- antes desta migration (usa a estimativa pela tabela de preços).
ALTER TABLE "whatsapp_outbound_messages" ADD COLUMN IF NOT EXISTS "pricing_category" text;
ALTER TABLE "whatsapp_outbound_messages" ADD COLUMN IF NOT EXISTS "pricing_billable" boolean;
ALTER TABLE "whatsapp_outbound_messages" ADD COLUMN IF NOT EXISTS "pricing_type" text;
