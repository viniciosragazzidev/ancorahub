-- Pós-venda, Fase 4 (09/11/2026): régua automática R1 a R5.
-- Plano: docs/implementations/active/2026-11-06-pos-venda-regua-automatica.md (seção "Implementação da Fase 4").
-- Aditivo. Sem a tabela, a tela mostra a régua desligada e o motor não envia nada.

CREATE TABLE IF NOT EXISTS "post_sale_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "key" text NOT NULL CHECK ("key" IN ('R1', 'R2', 'R3', 'R4', 'R5')),
  "enabled" boolean NOT NULL DEFAULT false,
  "delay_business_days" integer NOT NULL CHECK ("delay_business_days" BETWEEN 1 AND 60),
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "daily_limit" integer NOT NULL DEFAULT 60 CHECK ("daily_limit" BETWEEN 1 AND 60),
  "pilot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_sale_rules_tenant_key_unique"
  ON "post_sale_rules" ("tenant_id", "key");

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE "post_sale_rules" ENABLE ROW LEVEL SECURITY;

-- Correção da R0 (já no ar): os destinos r0_* não cabiam na restrição de outcome criada na 0217,
-- então a resposta do cliente à R0 falharia ao gravar. Mesma lista de antes mais os destinos da R0.
ALTER TABLE "post_sale_surveys" DROP CONSTRAINT IF EXISTS "post_sale_surveys_outcome_check";
ALTER TABLE "post_sale_surveys" ADD CONSTRAINT "post_sale_surveys_outcome_check" CHECK (
  "outcome" IS NULL OR "outcome" IN (
    'ok', 'no_contact', 'bad_service', 'closed', 'waiting', 'other',
    'r0_not_attended', 'r0_wants_more', 'r0_closed_elsewhere', 'r0_gave_up', 'r0_other'
  )
);
