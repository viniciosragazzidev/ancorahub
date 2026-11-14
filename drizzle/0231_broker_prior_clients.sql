-- DEC-187: Cliente que já possuo (carteira anterior do corretor), etapa 4b do plano do modo corretor.
-- Aditiva: todo cliente atual fica com source = 'sale' e lead_id preenchido. Nada aqui cria venda,
-- comissão, conversão ou pontos. Executada pelo responsável pelo banco, nunca durante a tarefa do agente.
ALTER TABLE clients ALTER COLUMN lead_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS origin_note text,
  ADD COLUMN IF NOT EXISTS created_by text REFERENCES "user"(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_source_check;
--> statement-breakpoint
ALTER TABLE clients ADD CONSTRAINT clients_source_check CHECK (
  (source = 'sale' AND lead_id IS NOT NULL) OR (source = 'prior_portfolio' AND lead_id IS NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS clients_tenant_corretor_source_idx ON clients (tenant_id, corretor_id, source);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_prior_contracts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  broker_id text NOT NULL REFERENCES "user"(id),
  branch_id text REFERENCES branches(id),
  product_type text NOT NULL DEFAULT 'unknown' CHECK (product_type IN ('PF', 'PJ', 'adesao', 'odonto', 'outro', 'unknown')),
  carrier_name text,
  carrier_id text,
  coverage_start_date date,
  renewal_date date,
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('active', 'cancelled', 'unknown')),
  notes text,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_prior_contracts_tenant_client_idx ON client_prior_contracts (tenant_id, client_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_prior_contracts_tenant_renewal_idx ON client_prior_contracts (tenant_id, renewal_date);

-- Reversão (manual, só se nenhum cliente de carteira anterior precisar ser mantido):
--   DROP TABLE IF EXISTS client_prior_contracts;
--   DELETE FROM clients WHERE source = 'prior_portfolio';
--   ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_source_check;
--   DROP INDEX IF EXISTS clients_tenant_corretor_source_idx;
--   ALTER TABLE clients DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS origin_note, DROP COLUMN IF EXISTS source;
--   ALTER TABLE clients ALTER COLUMN lead_id SET NOT NULL;
