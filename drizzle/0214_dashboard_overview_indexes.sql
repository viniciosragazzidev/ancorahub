-- Dashboard overview (Visão da operação) with the 7/30 day period and the unit filter:
--   * arrivals and leads per queue count live leads created since the window start,
--     for the whole tenant or one unit (Diretor's pick, Gestor's scope);
--   * distribution and the out-of-SLA attention item count live leads with a broker
--     by assigned_at since the window start.
-- leads had no index on created_at or assigned_at per tenant, so 7/30 days read
-- every live lead of the tenant.
--
-- Like 0209, this file is outside the journal: run each statement on its own in the
-- Supabase SQL editor before the deploy (CONCURRENTLY cannot run inside a transaction
-- block). Same content as docs/implementations/active/2026-10-24-diretor-lite/sql/indices-dashboard.sql.
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_created_live_idx
  ON leads (tenant_id, created_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_branch_created_live_idx
  ON leads (tenant_id, branch_id, created_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_assigned_live_idx
  ON leads (tenant_id, assigned_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL AND corretor_id IS NOT NULL;
