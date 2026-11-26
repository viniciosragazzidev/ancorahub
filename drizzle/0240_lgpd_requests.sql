-- Pedidos do titular (LGPD, 26/11/2026): exportar ou anonimizar, com prazo de 15 dias corridos.
-- Aditiva: só cria a tabela. Sem ela, exportar e anonimizar seguem funcionando e a seção "LGPD" avisa que falta a
-- migration (o código confere com to_regclass antes de usar).
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('export', 'anonymize')),
  reason text,
  requested_at timestamp with time zone NOT NULL,
  due_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  completed_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lgpd_requests_tenant_due_idx ON lgpd_requests (tenant_id, completed_at, due_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lgpd_requests_tenant_lead_idx ON lgpd_requests (tenant_id, lead_id, kind);
