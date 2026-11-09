-- Foto diária do Fechamento em Negociações (09/11/2026, pedido do diretor: "guarda a foto diária do fechamento").
-- Plano: docs/implementations/active/2026-11-09-fechamento-ate-negativa.md
-- Aditivo: uma tabela nova. Aplicar antes de ligar a tarefa /api/internal/jobs/negotiation-snapshot no Coolify;
-- sem a tabela, a tela de Negociações só esconde a faixa "Fechamento nos últimos dias".

CREATE TABLE IF NOT EXISTS "negotiation_daily_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "day" date NOT NULL,
  "counts" jsonb NOT NULL,
  "closing_leads" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "negotiation_daily_snapshots_tenant_day_unique"
  ON "negotiation_daily_snapshots" ("tenant_id", "day");

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE "negotiation_daily_snapshots" ENABLE ROW LEVEL SECURITY;
