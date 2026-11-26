-- Despesa que se repete todo mês (26/11/2026). Aditiva: só cria as duas tabelas.
-- A despesa aprovada é imutável (trigger erp_entries_immutable), por isso a regra fica fora dela.
-- Sem estas tabelas, a tela de despesas funciona como antes e "Repetir todo mês" avisa que ainda não está disponível
-- (o código confere com to_regclass antes de usar). Idempotência: um mês gerado por regra (unique em runs).
CREATE TABLE IF NOT EXISTS erp_recurring_expenses (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  origin_entry_id text NOT NULL REFERENCES erp_financial_entries(id),
  status text NOT NULL DEFAULT 'active',
  starts_competence text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  stopped_by text REFERENCES "user"(id),
  stopped_at timestamp with time zone,
  CONSTRAINT erp_recurring_expenses_status_check CHECK (status IN ('active', 'stopped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS erp_recurring_expenses_tenant_origin_unique ON erp_recurring_expenses (tenant_id, origin_entry_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS erp_recurring_expenses_tenant_status_idx ON erp_recurring_expenses (tenant_id, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_recurring_expense_runs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  recurring_id text NOT NULL REFERENCES erp_recurring_expenses(id),
  competence text NOT NULL,
  entry_id text NOT NULL REFERENCES erp_financial_entries(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS erp_recurring_expense_runs_rule_competence_unique ON erp_recurring_expense_runs (tenant_id, recurring_id, competence);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS erp_recurring_expense_runs_entry_unique ON erp_recurring_expense_runs (tenant_id, entry_id);
--> statement-breakpoint
ALTER TABLE erp_recurring_expenses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE erp_recurring_expense_runs ENABLE ROW LEVEL SECURITY;
