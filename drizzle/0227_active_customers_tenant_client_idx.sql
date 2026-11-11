-- Executar em autocommit, fora de transação: CONCURRENTLY não pode rodar em bloco transacional.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "active_customers_tenant_client_idx"
  ON "active_customers" ("tenant_id", "client_id");
